from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import StreamingResponse
import os
import logging
import io
import csv
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'abm-blinder-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

app = FastAPI(title="ABM Blinder API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = Field(default="pending", pattern="^(super_admin|admin|seat|pending)$")

class UserCreate(UserBase):
    password: str

class UserSignup(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    status: str = "active"
    created_at: str

class UserDetailResponse(BaseModel):
    """For admin viewing - includes password"""
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    status: str
    plain_password: str
    created_at: str

class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|seat)$")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = ""
    domains: List[str] = []
    # Lever settings
    gap_days: int = Field(default=3, ge=1, le=30)  # Days between follow-ups
    step_labels: List[str] = ["Intro Email", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 4"]
    # Advanced scheduling constraints
    mails_per_domain_per_day: int = Field(default=10, ge=1, le=100)  # Limit mails per domain per day
    jitter_minutes: int = Field(default=0, ge=0, le=120)  # Random jitter in minutes for natural scheduling

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    domains: List[str]
    gap_days: int
    step_labels: List[str]
    mails_per_domain_per_day: int = 10
    jitter_minutes: int = 0
    created_by: str
    created_at: str

class ProjectAssignment(BaseModel):
    project_id: str
    seat_id: str

class ScheduleLeverRequest(BaseModel):
    """Request to generate 5-step sequence for prospects"""
    project_id: str
    start_date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    prospect_ids: Optional[List[str]] = None  # If None, apply to all prospects in project

class ProspectBase(BaseModel):
    company_name: str
    contact_name: str
    email: str
    phone: Optional[str] = ""
    linkedin: Optional[str] = ""
    title: Optional[str] = ""
    domain: Optional[str] = ""
    custom_fields: Optional[Dict[str, Any]] = {}

class ProspectCreate(ProspectBase):
    project_id: str

class ProspectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    seat_id: str
    company_name: str
    contact_name: str
    email: str
    phone: str
    linkedin: str
    title: str
    domain: str
    custom_fields: Dict[str, Any]
    status: str
    created_at: str

class OutreachStepBase(BaseModel):
    step_number: int = Field(ge=1, le=4)
    subject: str
    body: str

class OutreachStepCreate(OutreachStepBase):
    prospect_id: str

class OutreachStepResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    prospect_id: str
    step_number: int
    subject: str
    body: str
    updated_at: str

class TaskBase(BaseModel):
    prospect_id: str
    step_number: int = Field(ge=1, le=4)
    send_date: str
    send_time: str

class TaskCreate(BaseModel):
    """For manual task creation by super admin"""
    prospect_id: Optional[str] = None
    seat_id: str
    project_id: str
    step_number: int = Field(ge=1, le=5)
    send_date: str
    send_time: str
    description: Optional[str] = ""

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    sent_timestamp: Optional[str] = None
    reply_content: Optional[str] = None
    send_date: Optional[str] = None  # For drag-drop rescheduling
    send_time: Optional[str] = None
    sent_email_content: Optional[str] = None  # Store the actual email content when marked as sent

class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    prospect_id: Optional[str] = None
    seat_id: str
    project_id: str
    step_number: int
    send_date: str
    send_time: str
    status: str
    sent_timestamp: Optional[str] = None
    sent_email_content: Optional[str] = None
    description: Optional[str] = ""
    created_at: str
    # Include prospect info for calendar display
    prospect_name: Optional[str] = None
    prospect_company: Optional[str] = None
    prospect_email: Optional[str] = None

class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    task_id: str
    prospect_id: str
    seat_id: str
    project_id: str
    action: str
    details: Dict[str, Any]
    timestamp: str

class ColumnMapping(BaseModel):
    mappings: Dict[str, str]
    project_id: str

class ScheduleUpload(BaseModel):
    tasks: List[TaskBase]

# Note models
class NoteCreate(BaseModel):
    prospect_id: str
    content: str

class NoteUpdate(BaseModel):
    content: str

class NoteResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    prospect_id: str
    user_id: str
    user_name: str
    content: str
    created_at: str
    updated_at: str

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_super_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is pending approval
    if user.get("status") == "pending_approval":
        raise HTTPException(status_code=403, detail="Account pending approval. Please wait for admin to approve your account.")
    
    if user.get("role") == "pending":
        raise HTTPException(status_code=403, detail="Account pending approval. Please wait for admin to approve your account.")
    
    token = create_token(user["id"], user["role"])
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            status=user.get("status", "active"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        status=user.get("status", "active"),
        created_at=user["created_at"]
    )

@api_router.post("/auth/signup", response_model=UserResponse)
async def signup(req: UserSignup):
    """Self-signup endpoint - users start as 'pending' until admin approves"""
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.name,
        "role": "pending",
        "status": "pending_approval",
        "password_hash": hash_password(req.password),
        "plain_password": req.password,  # Store for admin viewing
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        status=user_doc["status"],
        created_at=user_doc["created_at"]
    )

# ============== USER MANAGEMENT (Admin Only) ==============

@api_router.post("/users", response_model=UserResponse)
async def create_user(req: UserCreate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.name,
        "role": req.role,
        "status": "active",
        "password_hash": hash_password(req.password),
        "plain_password": req.password,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return UserResponse(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        status=user_doc["status"],
        created_at=user_doc["created_at"]
    )

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "plain_password": 0}).to_list(1000)
    return [UserResponse(**{**u, "status": u.get("status", "active")}) for u in users]

@api_router.get("/users/pending", response_model=List[UserDetailResponse])
async def list_pending_users(admin: dict = Depends(require_admin)):
    """Get all pending users awaiting approval - includes passwords for admin"""
    users = await db.users.find({"status": "pending_approval"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserDetailResponse(**{**u, "plain_password": u.get("plain_password", "")}) for u in users]

@api_router.get("/users/all-details", response_model=List[UserDetailResponse])
async def list_all_users_with_details(admin: dict = Depends(require_admin)):
    """Get all users with their passwords (admin only)"""
    users = await db.users.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserDetailResponse(**{**u, "status": u.get("status", "active"), "plain_password": u.get("plain_password", "")}) for u in users]

@api_router.get("/users/seats", response_model=List[UserResponse])
async def list_seats(admin: dict = Depends(require_admin)):
    users = await db.users.find({"role": "seat", "status": "active"}, {"_id": 0, "password_hash": 0, "plain_password": 0}).to_list(1000)
    return [UserResponse(**{**u, "status": u.get("status", "active")}) for u in users]

@api_router.put("/users/{user_id}/approve")
async def approve_user(user_id: str, role_update: UserRoleUpdate, admin: dict = Depends(require_admin)):
    """Approve a pending user and assign their role"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super_admin can create other admins
    if role_update.role == "admin" and admin["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create admins")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role_update.role, "status": "active"}}
    )
    return {"message": f"User approved as {role_update.role}"}

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role_update: UserRoleUpdate, admin: dict = Depends(require_super_admin)):
    """Update user role (super admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot change super admin role")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": role_update.role}})
    return {"message": f"User role updated to {role_update.role}"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete super admin")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    # Also remove assignments
    await db.project_assignments.delete_many({"seat_id": user_id})
    return {"message": "User deleted"}

# ============== PROJECT ENDPOINTS ==============

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, admin: dict = Depends(require_admin)):
    project_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "description": req.description or "",
        "domains": req.domains,
        "gap_days": req.gap_days,
        "step_labels": req.step_labels,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project_doc)
    return ProjectResponse(**project_doc)

@api_router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(user: dict = Depends(get_current_user)):
    if user["role"] in ["admin", "super_admin"]:
        projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    else:
        # Seat can only see assigned projects
        assignments = await db.project_assignments.find({"seat_id": user["id"]}, {"_id": 0}).to_list(1000)
        project_ids = [a["project_id"] for a in assignments]
        projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000)
    # Add defaults for existing projects
    for p in projects:
        if "gap_days" not in p:
            p["gap_days"] = 3
        if "step_labels" not in p:
            p["step_labels"] = ["Intro Email", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 4"]
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    # Add defaults
    if "gap_days" not in project:
        project["gap_days"] = 3
    if "step_labels" not in project:
        project["step_labels"] = ["Intro Email", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 4"]
    
    return ProjectResponse(**project)

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, req: ProjectCreate, admin: dict = Depends(require_admin)):
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "name": req.name, 
            "description": req.description, 
            "domains": req.domains,
            "gap_days": req.gap_days,
            "step_labels": req.step_labels
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if "gap_days" not in project:
        project["gap_days"] = 3
    if "step_labels" not in project:
        project["step_labels"] = ["Intro Email", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 4"]
    return ProjectResponse(**project)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, admin: dict = Depends(require_admin)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Cleanup related data
    await db.project_assignments.delete_many({"project_id": project_id})
    await db.prospects.delete_many({"project_id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ============== PROJECT ASSIGNMENTS ==============

@api_router.post("/projects/{project_id}/assign")
async def assign_seat_to_project(project_id: str, seat_id: str, admin: dict = Depends(require_admin)):
    # Verify project exists
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify seat exists
    seat = await db.users.find_one({"id": seat_id, "role": "seat"})
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
    
    # Check if already assigned
    existing = await db.project_assignments.find_one({"project_id": project_id, "seat_id": seat_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already assigned")
    
    assignment_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "seat_id": seat_id,
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.project_assignments.insert_one(assignment_doc)
    return {"message": "Seat assigned to project"}

@api_router.delete("/projects/{project_id}/assign/{seat_id}")
async def unassign_seat_from_project(project_id: str, seat_id: str, admin: dict = Depends(require_admin)):
    result = await db.project_assignments.delete_one({"project_id": project_id, "seat_id": seat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Seat unassigned from project"}

@api_router.get("/projects/{project_id}/seats", response_model=List[UserResponse])
async def get_project_seats(project_id: str, admin: dict = Depends(require_admin)):
    assignments = await db.project_assignments.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    seat_ids = [a["seat_id"] for a in assignments]
    seats = await db.users.find({"id": {"$in": seat_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**s) for s in seats]

# ============== PROSPECT ENDPOINTS ==============

@api_router.post("/prospects", response_model=ProspectResponse)
async def create_prospect(req: ProspectCreate, user: dict = Depends(get_current_user)):
    # Verify project access
    if user["role"] != "admin":
        assignment = await db.project_assignments.find_one({"project_id": req.project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    prospect_doc = {
        "id": str(uuid.uuid4()),
        "project_id": req.project_id,
        "seat_id": user["id"],
        "company_name": req.company_name,
        "contact_name": req.contact_name,
        "email": req.email,
        "phone": req.phone or "",
        "linkedin": req.linkedin or "",
        "title": req.title or "",
        "domain": req.domain or "",
        "custom_fields": req.custom_fields or {},
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prospects.insert_one(prospect_doc)
    return ProspectResponse(**prospect_doc)

@api_router.get("/prospects", response_model=List[ProspectResponse])
async def list_prospects(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "admin":
        if project_id:
            query["project_id"] = project_id
    else:
        # Seat can only see their own prospects
        query["seat_id"] = user["id"]
        if project_id:
            query["project_id"] = project_id
    
    prospects = await db.prospects.find(query, {"_id": 0}).to_list(10000)
    return [ProspectResponse(**p) for p in prospects]

@api_router.get("/prospects/{prospect_id}", response_model=ProspectResponse)
async def get_prospect(prospect_id: str, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return ProspectResponse(**prospect)

@api_router.put("/prospects/{prospect_id}", response_model=ProspectResponse)
async def update_prospect(prospect_id: str, req: ProspectBase, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = req.model_dump(exclude_unset=True)
    await db.prospects.update_one({"id": prospect_id}, {"$set": update_data})
    
    updated = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    return ProspectResponse(**updated)

@api_router.put("/prospects/{prospect_id}/status")
async def update_prospect_status(prospect_id: str, status: str, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.prospects.update_one({"id": prospect_id}, {"$set": {"status": status}})
    return {"message": "Status updated"}

@api_router.delete("/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.prospects.delete_one({"id": prospect_id})
    await db.outreach_steps.delete_many({"prospect_id": prospect_id})
    await db.tasks.delete_many({"prospect_id": prospect_id})
    return {"message": "Prospect deleted"}

# ============== CSV UPLOAD ==============

@api_router.post("/prospects/upload/parse")
async def parse_csv(file: UploadFile = File(...)):
    """Parse CSV and return headers for mapping"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.reader(io.StringIO(decoded))
    headers = next(reader)
    
    # Get first few rows as preview
    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 3:
            break
        preview_rows.append(dict(zip(headers, row)))
    
    return {"headers": headers, "preview": preview_rows}

@api_router.post("/prospects/upload/import")
async def import_csv(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    mappings: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Import CSV with column mappings"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    # Verify project access
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    # Parse mappings JSON
    try:
        column_mappings = json.loads(mappings)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mappings format")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    
    for i, row in enumerate(reader):
        try:
            prospect_data = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "seat_id": user["id"],
                "company_name": row.get(column_mappings.get("company_name", ""), ""),
                "contact_name": row.get(column_mappings.get("contact_name", ""), ""),
                "email": row.get(column_mappings.get("email", ""), ""),
                "phone": row.get(column_mappings.get("phone", ""), ""),
                "linkedin": row.get(column_mappings.get("linkedin", ""), ""),
                "title": row.get(column_mappings.get("title", ""), ""),
                "domain": row.get(column_mappings.get("domain", ""), ""),
                "custom_fields": {},
                "status": "new",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Add any unmapped columns to custom_fields
            mapped_cols = set(column_mappings.values())
            for col, val in row.items():
                if col not in mapped_cols and val:
                    prospect_data["custom_fields"][col] = val
            
            # Validate required fields
            if not prospect_data["email"] or not prospect_data["company_name"]:
                errors.append(f"Row {i+2}: Missing required fields (email or company_name)")
                continue
            
            await db.prospects.insert_one(prospect_data)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")
    
    return {"imported": imported, "errors": errors}

# ============== OUTREACH STEPS ==============

@api_router.post("/outreach-steps", response_model=OutreachStepResponse)
async def create_or_update_outreach_step(req: OutreachStepCreate, user: dict = Depends(get_current_user)):
    # Verify prospect access
    prospect = await db.prospects.find_one({"id": req.prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Upsert step
    existing = await db.outreach_steps.find_one(
        {"prospect_id": req.prospect_id, "step_number": req.step_number}
    )
    
    now = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.outreach_steps.update_one(
            {"id": existing["id"]},
            {"$set": {"subject": req.subject, "body": req.body, "updated_at": now}}
        )
        step = await db.outreach_steps.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        step_doc = {
            "id": str(uuid.uuid4()),
            "prospect_id": req.prospect_id,
            "step_number": req.step_number,
            "subject": req.subject,
            "body": req.body,
            "updated_at": now
        }
        await db.outreach_steps.insert_one(step_doc)
        step = step_doc
    
    return OutreachStepResponse(**step)

@api_router.get("/outreach-steps/{prospect_id}", response_model=List[OutreachStepResponse])
async def get_outreach_steps(prospect_id: str, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] != "admin" and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    steps = await db.outreach_steps.find({"prospect_id": prospect_id}, {"_id": 0}).sort("step_number", 1).to_list(4)
    return [OutreachStepResponse(**s) for s in steps]

# ============== TASKS ==============

@api_router.post("/tasks/schedule")
async def upload_schedule(admin: dict = Depends(require_admin), file: UploadFile = File(...)):
    """Admin uploads master schedule CSV with columns: prospect_id, step_number, send_date, send_time"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    created = 0
    errors = []
    
    for i, row in enumerate(reader):
        try:
            prospect_id = row.get("prospect_id", "").strip()
            step_number = int(row.get("step_number", 0))
            send_date = row.get("send_date", "").strip()
            send_time = row.get("send_time", "").strip()
            
            if not all([prospect_id, step_number, send_date, send_time]):
                errors.append(f"Row {i+2}: Missing required fields")
                continue
            
            # Get prospect to get seat_id and project_id
            prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
            if not prospect:
                errors.append(f"Row {i+2}: Prospect {prospect_id} not found")
                continue
            
            # Check if task already exists
            existing = await db.tasks.find_one({
                "prospect_id": prospect_id,
                "step_number": step_number
            })
            
            if existing:
                # Update existing task
                await db.tasks.update_one(
                    {"id": existing["id"]},
                    {"$set": {"send_date": send_date, "send_time": send_time}}
                )
            else:
                # Create new task
                task_doc = {
                    "id": str(uuid.uuid4()),
                    "prospect_id": prospect_id,
                    "seat_id": prospect["seat_id"],
                    "project_id": prospect["project_id"],
                    "step_number": step_number,
                    "send_date": send_date,
                    "send_time": send_time,
                    "status": "pending",
                    "sent_timestamp": None,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.tasks.insert_one(task_doc)
            
            created += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")
    
    return {"created": created, "errors": errors}

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(req: TaskCreate, admin: dict = Depends(require_admin)):
    """Super admin/admin can manually create tasks for any seat"""
    # Verify seat exists
    seat = await db.users.find_one({"id": req.seat_id, "role": "seat"}, {"_id": 0})
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
    
    # Verify project exists
    project = await db.projects.find_one({"id": req.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # If prospect_id provided, verify it exists
    if req.prospect_id:
        prospect = await db.prospects.find_one({"id": req.prospect_id}, {"_id": 0})
        if not prospect:
            raise HTTPException(status_code=404, detail="Prospect not found")
    
    task_doc = {
        "id": str(uuid.uuid4()),
        "prospect_id": req.prospect_id,
        "seat_id": req.seat_id,
        "project_id": req.project_id,
        "step_number": req.step_number,
        "send_date": req.send_date,
        "send_time": req.send_time,
        "status": "pending",
        "sent_timestamp": None,
        "description": req.description or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task_doc)
    return TaskResponse(**task_doc)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin: dict = Depends(require_admin)):
    """Admin can delete tasks"""
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@api_router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    date: Optional[str] = None,
    status: Optional[str] = None,
    seat_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] not in ["admin", "super_admin"]:
        query["seat_id"] = user["id"]
    elif seat_id:
        query["seat_id"] = seat_id
    
    if date:
        query["send_date"] = date
    if status:
        query["status"] = status
    if project_id:
        query["project_id"] = project_id
    
    # Date range for calendar view
    if start_date and end_date:
        query["send_date"] = {"$gte": start_date, "$lte": end_date}
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort([("send_date", 1), ("send_time", 1)]).to_list(10000)
    
    # Enrich tasks with prospect info
    enriched_tasks = []
    for t in tasks:
        if t.get("prospect_id"):
            prospect = await db.prospects.find_one({"id": t["prospect_id"]}, {"_id": 0})
            if prospect:
                t["prospect_name"] = prospect.get("contact_name", "")
                t["prospect_company"] = prospect.get("company_name", "")
                t["prospect_email"] = prospect.get("email", "")
        enriched_tasks.append(TaskResponse(**t))
    
    return enriched_tasks

@api_router.get("/tasks/calendar")
async def get_calendar_tasks(
    start_date: str,
    end_date: str,
    seat_id: Optional[str] = None,
    project_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get tasks formatted for calendar view"""
    query = {"send_date": {"$gte": start_date, "$lte": end_date}}
    
    if user["role"] not in ["admin", "super_admin"]:
        query["seat_id"] = user["id"]
    elif seat_id:
        query["seat_id"] = seat_id
    
    if project_id:
        query["project_id"] = project_id
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with prospect and project info
    calendar_events = []
    for t in tasks:
        event = {**t}
        if t.get("prospect_id"):
            prospect = await db.prospects.find_one({"id": t["prospect_id"]}, {"_id": 0})
            if prospect:
                event["prospect_name"] = prospect.get("contact_name", "")
                event["prospect_company"] = prospect.get("company_name", "")
                event["prospect_email"] = prospect.get("email", "")
        
        # Get project info
        project = await db.projects.find_one({"id": t["project_id"]}, {"_id": 0})
        if project:
            event["project_name"] = project.get("name", "")
            step_labels = project.get("step_labels", ["Intro", "F/U 1", "F/U 2", "F/U 3", "F/U 4"])
            event["step_label"] = step_labels[t["step_number"] - 1] if t["step_number"] <= len(step_labels) else f"Step {t['step_number']}"
        
        calendar_events.append(event)
    
    return calendar_events

@api_router.post("/tasks/lever")
async def apply_schedule_lever(req: ScheduleLeverRequest, admin: dict = Depends(require_admin)):
    """The LEVER: Auto-generate 5-step sequences for prospects with smart scheduling"""
    from datetime import timedelta
    import random
    
    # Get project for scheduling settings
    project = await db.projects.find_one({"id": req.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    gap_days = project.get("gap_days", 3)
    step_labels = project.get("step_labels", ["Intro Email", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 4"])
    mails_per_domain_per_day = project.get("mails_per_domain_per_day", 10)
    jitter_minutes = project.get("jitter_minutes", 0)
    
    # Get prospects
    prospect_query = {"project_id": req.project_id}
    if req.prospect_ids:
        prospect_query["id"] = {"$in": req.prospect_ids}
    
    prospects = await db.prospects.find(prospect_query, {"_id": 0}).to_list(10000)
    
    if not prospects:
        raise HTTPException(status_code=400, detail="No prospects found for this project")
    
    # Parse start date
    try:
        start_dt = datetime.strptime(f"{req.start_date} {req.start_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD and HH:MM")
    
    created_count = 0
    
    # Track domain usage per day for smart scheduling
    # Format: {date_string: {domain: count}}
    domain_day_tracker = {}
    
    def get_domain_from_email(email):
        """Extract domain from email address"""
        if email and '@' in email:
            return email.split('@')[1].lower()
        return 'unknown'
    
    def find_next_available_date(base_date, domain, domain_tracker, limit):
        """Find next date where domain limit is not exceeded"""
        current_date = base_date
        for _ in range(30):  # Max 30 days lookahead
            date_str = current_date.strftime("%Y-%m-%d")
            if date_str not in domain_tracker:
                domain_tracker[date_str] = {}
            if domain_tracker[date_str].get(domain, 0) < limit:
                domain_tracker[date_str][domain] = domain_tracker[date_str].get(domain, 0) + 1
                return current_date
            current_date = current_date + timedelta(days=1)
        return base_date  # Fallback to base date if no slot found
    
    for prospect in prospects:
        # Delete existing tasks for this prospect (to allow re-scheduling)
        await db.tasks.delete_many({"prospect_id": prospect["id"]})
        
        domain = get_domain_from_email(prospect.get("email", ""))
        
        # Create 5 tasks for each prospect
        for step in range(1, 6):
            base_task_date = start_dt + timedelta(days=(step - 1) * gap_days)
            
            # Apply domain-per-day limit
            task_date = find_next_available_date(base_task_date, domain, domain_day_tracker, mails_per_domain_per_day)
            
            # Apply jitter to time
            task_time = req.start_time
            if jitter_minutes > 0:
                jitter = random.randint(-jitter_minutes, jitter_minutes)
                task_datetime = datetime.strptime(f"{task_date.strftime('%Y-%m-%d')} {req.start_time}", "%Y-%m-%d %H:%M")
                task_datetime = task_datetime + timedelta(minutes=jitter)
                # Ensure time stays within business hours (8am - 7pm)
                if task_datetime.hour < 8:
                    task_datetime = task_datetime.replace(hour=8, minute=0)
                elif task_datetime.hour >= 19:
                    task_datetime = task_datetime.replace(hour=18, minute=45)
                task_time = task_datetime.strftime("%H:%M")
            
            task_doc = {
                "id": str(uuid.uuid4()),
                "prospect_id": prospect["id"],
                "seat_id": prospect["seat_id"],
                "project_id": req.project_id,
                "step_number": step,
                "send_date": task_date.strftime("%Y-%m-%d"),
                "send_time": task_time,
                "status": "pending",
                "sent_timestamp": None,
                "sent_email_content": None,
                "description": step_labels[step - 1] if step <= len(step_labels) else f"Step {step}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.tasks.insert_one(task_doc)
            created_count += 1
    
    return {
        "message": f"Generated {created_count} tasks for {len(prospects)} prospects",
        "prospects_count": len(prospects),
        "tasks_count": created_count,
        "gap_days": gap_days,
        "mails_per_domain_per_day": mails_per_domain_per_day,
        "jitter_minutes": jitter_minutes,
        "start_date": req.start_date
    }

@api_router.get("/tasks/today", response_model=List[TaskResponse])
async def get_today_tasks(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"send_date": today}
    if user["role"] not in ["admin", "super_admin"]:
        query["seat_id"] = user["id"]
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("send_time", 1).to_list(1000)
    return [TaskResponse(**t) for t in tasks]

@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, req: TaskUpdate, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if user["role"] not in ["admin", "super_admin"] and task["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if req.status:
        update_data["status"] = req.status
    if req.sent_timestamp:
        update_data["sent_timestamp"] = req.sent_timestamp
    # Support drag-drop rescheduling
    if req.send_date:
        update_data["send_date"] = req.send_date
    if req.send_time:
        update_data["send_time"] = req.send_time
    # Store sent email content
    if req.sent_email_content:
        update_data["sent_email_content"] = req.sent_email_content
    
    if update_data:
        await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Log activity
    if req.status == "sent":
        log_details = {"sent_timestamp": req.sent_timestamp}
        if req.sent_email_content:
            log_details["sent_email_content"] = req.sent_email_content
        
        log_doc = {
            "id": str(uuid.uuid4()),
            "task_id": task_id,
            "prospect_id": task["prospect_id"],
            "seat_id": task["seat_id"],
            "project_id": task["project_id"],
            "action": "sent",
            "details": log_details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_logs.insert_one(log_doc)
        
        # Update prospect status
        if task.get("prospect_id"):
            await db.prospects.update_one(
                {"id": task["prospect_id"]},
                {"$set": {"status": f"step_{task['step_number']}_sent"}}
            )
    
    if req.reply_content:
        log_doc = {
            "id": str(uuid.uuid4()),
            "task_id": task_id,
            "prospect_id": task["prospect_id"],
            "seat_id": task["seat_id"],
            "project_id": task["project_id"],
            "action": "reply_received",
            "details": {"reply_content": req.reply_content},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_logs.insert_one(log_doc)
        
        # Update prospect status
        if task.get("prospect_id"):
            await db.prospects.update_one(
                {"id": task["prospect_id"]},
                {"$set": {"status": "replied"}}
            )
    
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return TaskResponse(**updated)

# ============== ACTIVITY LOGS ==============

@api_router.get("/activity-logs", response_model=List[ActivityLogResponse])
async def list_activity_logs(
    project_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] != "admin":
        query["seat_id"] = user["id"]
    if project_id:
        query["project_id"] = project_id
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    return [ActivityLogResponse(**l) for l in logs]

# ============== EXPORT ==============

@api_router.get("/export/activity")
async def export_activity(admin: dict = Depends(require_admin)):
    """Export all activity as CSV"""
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100000)
    
    output = io.StringIO()
    if logs:
        fieldnames = ["id", "task_id", "prospect_id", "seat_id", "project_id", "action", "details", "timestamp"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for log in logs:
            row = {**log}
            row["details"] = str(row.get("details", {}))
            writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_export.csv"}
    )

@api_router.get("/export/prospects")
async def export_prospects(project_id: Optional[str] = None, admin: dict = Depends(require_admin)):
    """Export prospects as CSV"""
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    prospects = await db.prospects.find(query, {"_id": 0}).to_list(100000)
    
    output = io.StringIO()
    if prospects:
        fieldnames = ["id", "project_id", "seat_id", "company_name", "contact_name", "email", 
                      "phone", "linkedin", "title", "domain", "status", "created_at"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for p in prospects:
            row = {k: v for k, v in p.items() if k in fieldnames}
            writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=prospects_export.csv"}
    )

# ============== STATS ==============

@api_router.get("/stats/overview")
async def get_overview_stats(user: dict = Depends(get_current_user)):
    if user["role"] in ["admin", "super_admin"]:
        total_projects = await db.projects.count_documents({})
        total_seats = await db.users.count_documents({"role": "seat", "status": "active"})
        total_admins = await db.users.count_documents({"role": "admin", "status": "active"})
        pending_users = await db.users.count_documents({"status": "pending_approval"})
        total_prospects = await db.prospects.count_documents({})
        total_tasks = await db.tasks.count_documents({})
        pending_tasks = await db.tasks.count_documents({"status": "pending"})
        sent_tasks = await db.tasks.count_documents({"status": "sent"})
        replied = await db.prospects.count_documents({"status": "replied"})
    else:
        total_projects = await db.project_assignments.count_documents({"seat_id": user["id"]})
        total_seats = 0
        total_admins = 0
        pending_users = 0
        total_prospects = await db.prospects.count_documents({"seat_id": user["id"]})
        total_tasks = await db.tasks.count_documents({"seat_id": user["id"]})
        pending_tasks = await db.tasks.count_documents({"seat_id": user["id"], "status": "pending"})
        sent_tasks = await db.tasks.count_documents({"seat_id": user["id"], "status": "sent"})
        replied = await db.prospects.count_documents({"seat_id": user["id"], "status": "replied"})
    
    return {
        "total_projects": total_projects,
        "total_seats": total_seats,
        "total_admins": total_admins,
        "pending_users": pending_users,
        "total_prospects": total_prospects,
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "sent_tasks": sent_tasks,
        "replied": replied
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "ABM Blinder API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ============== INIT ADMIN ==============

@app.on_event("startup")
async def init_admin():
    """Create super admin if not exists"""
    super_admin = await db.users.find_one({"email": "srihariramasheshu@gmail.com"})
    if not super_admin:
        super_admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "srihariramasheshu@gmail.com",
            "name": "Super Admin",
            "role": "super_admin",
            "status": "active",
            "password_hash": hash_password("superadmin123"),
            "plain_password": "superadmin123",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(super_admin_doc)
        logger.info("Created super admin: srihariramasheshu@gmail.com / superadmin123")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
