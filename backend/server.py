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

# ============== MAIL DOMAIN & MAIL ID MODELS ==============

class MailDomainCreate(BaseModel):
    domain: str
    project_id: str

class MailDomainResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    domain: str
    project_id: str
    created_by: str
    created_at: str

class MailIdCreate(BaseModel):
    email: str
    domain_id: str

class MailIdUpdate(BaseModel):
    seat_id: Optional[str] = None  # Assign/unassign seat

class MailIdResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    domain_id: str
    project_id: str
    seat_id: Optional[str] = None
    created_at: str

# ============== PROJECT MODELS ==============

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = ""
    # Scheduler configuration
    max_mails_per_day_per_mail_id: int = Field(default=10, ge=1, le=100)
    min_time_gap_minutes: int = Field(default=5, ge=1, le=120)  # Min gap between mails from same mail-id
    time_jitter_minutes: int = Field(default=0, ge=0, le=60)  # Random jitter
    touchpoints_count: int = Field(default=5, ge=1, le=10)  # Number of touchpoints per sequence
    touchpoint_gaps: List[int] = [0, 3, 5, 7, 10]  # Gap in days for each touchpoint (first is always 0)
    work_start_time: str = "09:00"  # HH:MM
    work_end_time: str = "18:00"  # HH:MM
    working_days: List[int] = [1, 2, 3, 4, 5]  # 1=Monday, 7=Sunday

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    max_mails_per_day_per_mail_id: int = 10
    min_time_gap_minutes: int = 5
    time_jitter_minutes: int = 0
    touchpoints_count: int = 5
    touchpoint_gaps: List[int] = [0, 3, 5, 7, 10]
    work_start_time: str = "09:00"
    work_end_time: str = "18:00"
    working_days: List[int] = [1, 2, 3, 4, 5]
    created_by: str
    created_at: str

class ProjectAssignment(BaseModel):
    project_id: str
    seat_id: str

# ============== SCHEDULING REPORT MODEL ==============

class SchedulingReportResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    seat_id: str
    total_prospects: int
    scheduled_prospects: int
    failed_prospects: int
    total_tasks_created: int
    report_data: Dict[str, Any]
    created_at: str

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
    assigned_mail_id: Optional[str] = None
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
    step_number: int = Field(ge=1, le=10)
    send_date: str
    send_time: str
    description: Optional[str] = ""
    assigned_mail_id: Optional[str] = None

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
    assigned_mail_id: Optional[str] = None
    assigned_mail_email: Optional[str] = None  # Email address for display
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
        "max_mails_per_day_per_mail_id": req.max_mails_per_day_per_mail_id,
        "min_time_gap_minutes": req.min_time_gap_minutes,
        "time_jitter_minutes": req.time_jitter_minutes,
        "touchpoints_count": req.touchpoints_count,
        "touchpoint_gaps": req.touchpoint_gaps,
        "work_start_time": req.work_start_time,
        "work_end_time": req.work_end_time,
        "working_days": req.working_days,
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
    
    # Add defaults for existing projects (migration support)
    for p in projects:
        if "max_mails_per_day_per_mail_id" not in p:
            p["max_mails_per_day_per_mail_id"] = 10
        if "min_time_gap_minutes" not in p:
            p["min_time_gap_minutes"] = 5
        if "time_jitter_minutes" not in p:
            p["time_jitter_minutes"] = 0
        if "touchpoints_count" not in p:
            p["touchpoints_count"] = 5
        if "touchpoint_gaps" not in p:
            p["touchpoint_gaps"] = [0, 3, 5, 7, 10]
        if "work_start_time" not in p:
            p["work_start_time"] = "09:00"
        if "work_end_time" not in p:
            p["work_end_time"] = "18:00"
        if "working_days" not in p:
            p["working_days"] = [1, 2, 3, 4, 5]
    
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
    
    # Add defaults for migration
    if "max_mails_per_day_per_mail_id" not in project:
        project["max_mails_per_day_per_mail_id"] = 10
    if "min_time_gap_minutes" not in project:
        project["min_time_gap_minutes"] = 5
    if "time_jitter_minutes" not in project:
        project["time_jitter_minutes"] = 0
    if "touchpoints_count" not in project:
        project["touchpoints_count"] = 5
    if "touchpoint_gaps" not in project:
        project["touchpoint_gaps"] = [0, 3, 5, 7, 10]
    if "work_start_time" not in project:
        project["work_start_time"] = "09:00"
    if "work_end_time" not in project:
        project["work_end_time"] = "18:00"
    if "working_days" not in project:
        project["working_days"] = [1, 2, 3, 4, 5]
    
    return ProjectResponse(**project)

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, req: ProjectCreate, admin: dict = Depends(require_admin)):
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "name": req.name, 
            "description": req.description,
            "max_mails_per_day_per_mail_id": req.max_mails_per_day_per_mail_id,
            "min_time_gap_minutes": req.min_time_gap_minutes,
            "time_jitter_minutes": req.time_jitter_minutes,
            "touchpoints_count": req.touchpoints_count,
            "touchpoint_gaps": req.touchpoint_gaps,
            "work_start_time": req.work_start_time,
            "work_end_time": req.work_end_time,
            "working_days": req.working_days
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    # Add defaults for migration
    if "max_mails_per_day_per_mail_id" not in project:
        project["max_mails_per_day_per_mail_id"] = 10
    if "min_time_gap_minutes" not in project:
        project["min_time_gap_minutes"] = 5
    if "time_jitter_minutes" not in project:
        project["time_jitter_minutes"] = 0
    if "touchpoints_count" not in project:
        project["touchpoints_count"] = 5
    if "touchpoint_gaps" not in project:
        project["touchpoint_gaps"] = [0, 3, 5, 7, 10]
    if "work_start_time" not in project:
        project["work_start_time"] = "09:00"
    if "work_end_time" not in project:
        project["work_end_time"] = "18:00"
    if "working_days" not in project:
        project["working_days"] = [1, 2, 3, 4, 5]
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
    await db.mail_domains.delete_many({"project_id": project_id})
    await db.mail_ids.delete_many({"project_id": project_id})
    await db.scheduling_reports.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ============== MAIL DOMAIN MANAGEMENT ==============

@api_router.post("/mail-domains", response_model=MailDomainResponse)
async def create_mail_domain(req: MailDomainCreate, admin: dict = Depends(require_admin)):
    """Create a mail domain for a project. One domain can only belong to one project."""
    # Check if domain is already used by any project
    existing = await db.mail_domains.find_one({"domain": req.domain.lower()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Domain '{req.domain}' is already assigned to another project")
    
    # Verify project exists
    project = await db.projects.find_one({"id": req.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    domain_doc = {
        "id": str(uuid.uuid4()),
        "domain": req.domain.lower(),
        "project_id": req.project_id,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mail_domains.insert_one(domain_doc)
    return MailDomainResponse(**domain_doc)

@api_router.get("/mail-domains", response_model=List[MailDomainResponse])
async def list_mail_domains(project_id: Optional[str] = None, admin: dict = Depends(require_admin)):
    """List all mail domains, optionally filtered by project"""
    query = {}
    if project_id:
        query["project_id"] = project_id
    domains = await db.mail_domains.find(query, {"_id": 0}).to_list(1000)
    return [MailDomainResponse(**d) for d in domains]

@api_router.get("/projects/{project_id}/mail-domains", response_model=List[MailDomainResponse])
async def get_project_mail_domains(project_id: str, user: dict = Depends(get_current_user)):
    """Get mail domains for a project"""
    # Verify project access
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    domains = await db.mail_domains.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [MailDomainResponse(**d) for d in domains]

@api_router.delete("/mail-domains/{domain_id}")
async def delete_mail_domain(domain_id: str, admin: dict = Depends(require_admin)):
    """Delete a mail domain and all its mail IDs"""
    domain = await db.mail_domains.find_one({"id": domain_id})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Delete all mail IDs under this domain
    await db.mail_ids.delete_many({"domain_id": domain_id})
    await db.mail_domains.delete_one({"id": domain_id})
    return {"message": "Domain and associated mail IDs deleted"}

# ============== MAIL ID MANAGEMENT ==============

@api_router.post("/mail-ids", response_model=MailIdResponse)
async def create_mail_id(req: MailIdCreate, admin: dict = Depends(require_admin)):
    """Create a mail ID under a domain. One mail ID can only exist in one project."""
    # Check if mail ID already exists anywhere
    existing = await db.mail_ids.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Mail ID '{req.email}' already exists in another project")
    
    # Verify domain exists
    domain = await db.mail_domains.find_one({"id": req.domain_id})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Validate email belongs to domain
    email_domain = req.email.lower().split('@')[-1] if '@' in req.email else ''
    if email_domain != domain["domain"]:
        raise HTTPException(status_code=400, detail=f"Email must belong to domain '{domain['domain']}'")
    
    mail_id_doc = {
        "id": str(uuid.uuid4()),
        "email": req.email.lower(),
        "domain_id": req.domain_id,
        "project_id": domain["project_id"],
        "seat_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mail_ids.insert_one(mail_id_doc)
    return MailIdResponse(**mail_id_doc)

@api_router.get("/mail-ids", response_model=List[MailIdResponse])
async def list_mail_ids(
    project_id: Optional[str] = None, 
    domain_id: Optional[str] = None,
    seat_id: Optional[str] = None,
    unassigned: Optional[bool] = None,
    admin: dict = Depends(require_admin)
):
    """List mail IDs with optional filters"""
    query = {}
    if project_id:
        query["project_id"] = project_id
    if domain_id:
        query["domain_id"] = domain_id
    if seat_id:
        query["seat_id"] = seat_id
    if unassigned:
        query["seat_id"] = None
    
    mail_ids = await db.mail_ids.find(query, {"_id": 0}).to_list(1000)
    return [MailIdResponse(**m) for m in mail_ids]

@api_router.get("/projects/{project_id}/mail-ids", response_model=List[MailIdResponse])
async def get_project_mail_ids(project_id: str, user: dict = Depends(get_current_user)):
    """Get all mail IDs for a project"""
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    mail_ids = await db.mail_ids.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [MailIdResponse(**m) for m in mail_ids]

@api_router.get("/seats/{seat_id}/mail-ids", response_model=List[MailIdResponse])
async def get_seat_mail_ids(seat_id: str, user: dict = Depends(get_current_user)):
    """Get mail IDs assigned to a seat"""
    if user["role"] not in ["admin", "super_admin"] and user["id"] != seat_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    mail_ids = await db.mail_ids.find({"seat_id": seat_id}, {"_id": 0}).to_list(1000)
    return [MailIdResponse(**m) for m in mail_ids]

@api_router.put("/mail-ids/{mail_id_id}/assign")
async def assign_mail_id_to_seat(mail_id_id: str, req: MailIdUpdate, admin: dict = Depends(require_admin)):
    """Assign or unassign a mail ID to/from a seat"""
    mail_id = await db.mail_ids.find_one({"id": mail_id_id})
    if not mail_id:
        raise HTTPException(status_code=404, detail="Mail ID not found")
    
    if req.seat_id:
        # Verify seat exists
        seat = await db.users.find_one({"id": req.seat_id, "role": "seat"})
        if not seat:
            raise HTTPException(status_code=404, detail="Seat not found")
        
        # Verify seat is assigned to the project
        assignment = await db.project_assignments.find_one({
            "project_id": mail_id["project_id"], 
            "seat_id": req.seat_id
        })
        if not assignment:
            raise HTTPException(status_code=400, detail="Seat is not assigned to this project")
        
        # Check if mail ID is already assigned to another seat
        if mail_id.get("seat_id") and mail_id["seat_id"] != req.seat_id:
            raise HTTPException(status_code=400, detail="Mail ID is already assigned to another seat")
    
    await db.mail_ids.update_one({"id": mail_id_id}, {"$set": {"seat_id": req.seat_id}})
    return {"message": f"Mail ID {'assigned' if req.seat_id else 'unassigned'} successfully"}

@api_router.delete("/mail-ids/{mail_id_id}")
async def delete_mail_id(mail_id_id: str, admin: dict = Depends(require_admin)):
    """Delete a mail ID"""
    result = await db.mail_ids.delete_one({"id": mail_id_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mail ID not found")
    return {"message": "Mail ID deleted"}

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
    if user["role"] not in ["admin", "super_admin"]:
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
        "assigned_mail_id": None,
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
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return ProspectResponse(**prospect)

@api_router.put("/prospects/{prospect_id}", response_model=ProspectResponse)
async def update_prospect(prospect_id: str, req: ProspectBase, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
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
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.prospects.update_one({"id": prospect_id}, {"$set": {"status": status}})
    return {"message": "Status updated"}

@api_router.delete("/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str, user: dict = Depends(get_current_user)):
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
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
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
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
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
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
    
    # Enrich with prospect, project, and mail ID info
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
            touchpoints_count = project.get("touchpoints_count", 5)
            step_label = f"Touchpoint {t['step_number']}" if t['step_number'] <= touchpoints_count else f"Step {t['step_number']}"
            if t['step_number'] == 1:
                step_label = "Intro Email"
            elif t['step_number'] <= touchpoints_count:
                step_label = f"Follow-up {t['step_number'] - 1}"
            event["step_label"] = step_label
        
        # Get mail ID info
        if t.get("assigned_mail_id"):
            mail_id = await db.mail_ids.find_one({"id": t["assigned_mail_id"]}, {"_id": 0})
            if mail_id:
                event["assigned_mail_email"] = mail_id.get("email", "")
        
        calendar_events.append(event)
    
    return calendar_events

# ============== SMART SCHEDULING ENGINE ==============

class ScheduleProspectsRequest(BaseModel):
    """Request to schedule prospects with the smart engine"""
    project_id: str
    prospect_ids: Optional[List[str]] = None  # If None, schedule all unscheduled prospects

@api_router.post("/projects/{project_id}/check-config")
async def check_project_config(project_id: str, user: dict = Depends(get_current_user)):
    """Check if project has all required configuration for scheduling"""
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    issues = []
    
    # Check mail domains
    domains = await db.mail_domains.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    if not domains:
        issues.append("No mail domains configured for this project")
    
    # Check mail IDs
    mail_ids = await db.mail_ids.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    if not mail_ids:
        issues.append("No mail IDs configured for this project")
    
    # Check if seat has mail IDs assigned (for seat users)
    if user["role"] == "seat":
        seat_mail_ids = await db.mail_ids.find({"project_id": project_id, "seat_id": user["id"]}, {"_id": 0}).to_list(100)
        if not seat_mail_ids:
            issues.append("No mail IDs assigned to you for this project")
    
    # Check scheduling config
    if not project.get("touchpoints_count") or project.get("touchpoints_count", 0) < 1:
        issues.append("Touchpoints count not configured")
    
    touchpoint_gaps = project.get("touchpoint_gaps", [])
    touchpoints_count = project.get("touchpoints_count", 5)
    if len(touchpoint_gaps) < touchpoints_count:
        issues.append(f"Touchpoint gaps not fully configured (need {touchpoints_count}, have {len(touchpoint_gaps)})")
    
    if not project.get("working_days"):
        issues.append("Working days not configured")
    
    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "domains_count": len(domains),
        "mail_ids_count": len(mail_ids),
        "touchpoints_count": project.get("touchpoints_count", 5)
    }

@api_router.post("/projects/{project_id}/schedule-prospects", response_model=SchedulingReportResponse)
async def schedule_prospects(project_id: str, user: dict = Depends(get_current_user)):
    """
    Smart scheduling engine that:
    1. Gets unscheduled prospects for the seat
    2. Assigns mail IDs using round-robin
    3. Schedules all touchpoints respecting all constraints
    4. Returns a detailed scheduling report
    """
    from datetime import timedelta
    import random
    
    # Verify project access
    if user["role"] not in ["admin", "super_admin"]:
        assignment = await db.project_assignments.find_one({"project_id": project_id, "seat_id": user["id"]})
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    
    # Get project config
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get scheduling config with defaults
    max_mails_per_day = project.get("max_mails_per_day_per_mail_id", 10)
    min_time_gap = project.get("min_time_gap_minutes", 5)
    time_jitter = project.get("time_jitter_minutes", 0)
    touchpoints_count = project.get("touchpoints_count", 5)
    touchpoint_gaps = project.get("touchpoint_gaps", [0, 3, 5, 7, 10])
    work_start = project.get("work_start_time", "09:00")
    work_end = project.get("work_end_time", "18:00")
    working_days = project.get("working_days", [1, 2, 3, 4, 5])  # 1=Monday
    
    # Parse work hours
    work_start_h, work_start_m = map(int, work_start.split(':'))
    work_end_h, work_end_m = map(int, work_end.split(':'))
    
    # Get seat's mail IDs
    mail_id_query = {"project_id": project_id}
    if user["role"] == "seat":
        mail_id_query["seat_id"] = user["id"]
    
    mail_ids = await db.mail_ids.find(mail_id_query, {"_id": 0}).to_list(100)
    if not mail_ids:
        raise HTTPException(status_code=400, detail="No mail IDs available for scheduling")
    
    # Get prospects that need scheduling (no assigned_mail_id or no tasks)
    prospect_query = {"project_id": project_id, "seat_id": user["id"]}
    prospects = await db.prospects.find(prospect_query, {"_id": 0}).to_list(10000)
    
    # Filter to only unscheduled prospects (those without assigned_mail_id)
    unscheduled_prospects = [p for p in prospects if not p.get("assigned_mail_id")]
    
    if not unscheduled_prospects:
        raise HTTPException(status_code=400, detail="No unscheduled prospects found")
    
    # Initialize tracking structures
    # Track mail usage: {mail_id: {date: [scheduled_times]}}
    mail_schedule_tracker = {m["id"]: {} for m in mail_ids}
    
    # Load existing tasks to populate tracker
    existing_tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(100000)
    for task in existing_tasks:
        if task.get("assigned_mail_id"):
            mid = task["assigned_mail_id"]
            if mid in mail_schedule_tracker:
                date = task["send_date"]
                if date not in mail_schedule_tracker[mid]:
                    mail_schedule_tracker[mid][date] = []
                mail_schedule_tracker[mid][date].append(task["send_time"])
    
    # Round-robin mail ID assignment
    mail_id_index = 0
    
    def get_next_mail_id():
        nonlocal mail_id_index
        mail_id = mail_ids[mail_id_index % len(mail_ids)]
        mail_id_index += 1
        return mail_id
    
    def is_working_day(dt):
        return dt.isoweekday() in working_days
    
    def find_next_working_day(dt):
        while not is_working_day(dt):
            dt = dt + timedelta(days=1)
        return dt
    
    def get_available_time_slot(mail_id_id, target_date, tracker):
        """Find an available time slot for a mail ID on a given date"""
        date_str = target_date.strftime("%Y-%m-%d")
        
        # Get existing times for this mail ID on this date
        existing_times = tracker.get(mail_id_id, {}).get(date_str, [])
        
        # Check if we've hit the daily limit
        if len(existing_times) >= max_mails_per_day:
            return None
        
        if not existing_times:
            # First email of the day - start at work_start with optional jitter
            base_minutes = work_start_h * 60 + work_start_m
            if time_jitter > 0:
                base_minutes += random.randint(0, time_jitter)
        else:
            # Find the latest existing time and add min_time_gap
            latest_time = max(existing_times)
            h, m = map(int, latest_time.split(':'))
            base_minutes = h * 60 + m + min_time_gap
            if time_jitter > 0:
                base_minutes += random.randint(0, time_jitter)
        
        # Check if we're still within work hours
        if base_minutes >= work_end_h * 60 + work_end_m:
            return None
        
        hours = base_minutes // 60
        minutes = base_minutes % 60
        return f"{hours:02d}:{minutes:02d}"
    
    # Scheduling results
    scheduled_prospects = []
    failed_prospects = []
    total_tasks_created = 0
    
    today = datetime.now(timezone.utc).date()
    start_date = today + timedelta(days=1)  # Start scheduling from tomorrow
    start_date = datetime.combine(start_date, datetime.min.time())
    
    for prospect in unscheduled_prospects:
        assigned_mail = get_next_mail_id()
        prospect_tasks = []
        scheduling_failed = False
        failed_reason = None
        
        for tp_index in range(touchpoints_count):
            if tp_index >= len(touchpoint_gaps):
                gap_days = touchpoint_gaps[-1] if touchpoint_gaps else 3
            else:
                gap_days = touchpoint_gaps[tp_index]
            
            # Calculate base date for this touchpoint
            if tp_index == 0:
                base_date = start_date
            else:
                # Add gap from previous touchpoint
                prev_task = prospect_tasks[-1]
                prev_date = datetime.strptime(prev_task["send_date"], "%Y-%m-%d")
                base_date = prev_date + timedelta(days=gap_days)
            
            # Find next working day
            target_date = find_next_working_day(base_date)
            
            # Try to find an available slot within 14 days
            max_attempts = 14
            slot_found = False
            
            for attempt in range(max_attempts):
                check_date = target_date + timedelta(days=attempt)
                if not is_working_day(check_date):
                    continue
                
                time_slot = get_available_time_slot(
                    assigned_mail["id"],
                    check_date,
                    mail_schedule_tracker
                )
                
                if time_slot:
                    # Found a slot!
                    date_str = check_date.strftime("%Y-%m-%d")
                    
                    # Update tracker
                    if assigned_mail["id"] not in mail_schedule_tracker:
                        mail_schedule_tracker[assigned_mail["id"]] = {}
                    if date_str not in mail_schedule_tracker[assigned_mail["id"]]:
                        mail_schedule_tracker[assigned_mail["id"]][date_str] = []
                    mail_schedule_tracker[assigned_mail["id"]][date_str].append(time_slot)
                    
                    # Create task
                    step_label = "Intro Email" if tp_index == 0 else f"Follow-up {tp_index}"
                    task_doc = {
                        "id": str(uuid.uuid4()),
                        "prospect_id": prospect["id"],
                        "seat_id": prospect["seat_id"],
                        "project_id": project_id,
                        "step_number": tp_index + 1,
                        "send_date": date_str,
                        "send_time": time_slot,
                        "status": "pending",
                        "sent_timestamp": None,
                        "sent_email_content": None,
                        "assigned_mail_id": assigned_mail["id"],
                        "description": step_label,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    prospect_tasks.append(task_doc)
                    slot_found = True
                    break
            
            if not slot_found:
                scheduling_failed = True
                failed_reason = f"Could not schedule touchpoint {tp_index + 1} within 2 weeks"
                break
        
        if scheduling_failed:
            failed_prospects.append({
                "prospect_id": prospect["id"],
                "company_name": prospect.get("company_name", ""),
                "contact_name": prospect.get("contact_name", ""),
                "reason": failed_reason
            })
        else:
            # Save all tasks for this prospect
            for task in prospect_tasks:
                await db.tasks.insert_one(task)
                total_tasks_created += 1
            
            # Update prospect with assigned mail ID
            await db.prospects.update_one(
                {"id": prospect["id"]},
                {"$set": {"assigned_mail_id": assigned_mail["id"]}}
            )
            
            scheduled_prospects.append({
                "prospect_id": prospect["id"],
                "company_name": prospect.get("company_name", ""),
                "contact_name": prospect.get("contact_name", ""),
                "assigned_mail_id": assigned_mail["id"],
                "assigned_mail_email": assigned_mail["email"],
                "tasks_count": len(prospect_tasks),
                "first_task_date": prospect_tasks[0]["send_date"],
                "last_task_date": prospect_tasks[-1]["send_date"]
            })
    
    # Create scheduling report
    report_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "seat_id": user["id"],
        "total_prospects": len(unscheduled_prospects),
        "scheduled_prospects": len(scheduled_prospects),
        "failed_prospects": len(failed_prospects),
        "total_tasks_created": total_tasks_created,
        "report_data": {
            "scheduled": scheduled_prospects,
            "failed": failed_prospects,
            "config": {
                "max_mails_per_day": max_mails_per_day,
                "min_time_gap": min_time_gap,
                "time_jitter": time_jitter,
                "touchpoints_count": touchpoints_count,
                "touchpoint_gaps": touchpoint_gaps[:touchpoints_count],
                "work_hours": f"{work_start} - {work_end}",
                "working_days": working_days,
                "mail_ids_used": len(mail_ids)
            }
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scheduling_reports.insert_one(report_doc)
    
    return SchedulingReportResponse(**report_doc)

@api_router.get("/projects/{project_id}/scheduling-reports", response_model=List[SchedulingReportResponse])
async def get_scheduling_reports(project_id: str, user: dict = Depends(get_current_user)):
    """Get scheduling reports for a project"""
    query = {"project_id": project_id}
    
    # Seat can only see their own reports
    if user["role"] == "seat":
        query["seat_id"] = user["id"]
    
    reports = await db.scheduling_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [SchedulingReportResponse(**r) for r in reports]

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

# ============== PROSPECT NOTES ==============

@api_router.post("/notes", response_model=NoteResponse)
async def create_note(req: NoteCreate, user: dict = Depends(get_current_user)):
    """Create a note for a prospect"""
    # Verify prospect exists and user has access
    prospect = await db.prospects.find_one({"id": req.prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to add notes to this prospect")
    
    now = datetime.now(timezone.utc).isoformat()
    note_doc = {
        "id": str(uuid.uuid4()),
        "prospect_id": req.prospect_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "content": req.content,
        "created_at": now,
        "updated_at": now
    }
    await db.notes.insert_one(note_doc)
    return NoteResponse(**note_doc)

@api_router.get("/notes/prospect/{prospect_id}", response_model=List[NoteResponse])
async def get_prospect_notes(prospect_id: str, user: dict = Depends(get_current_user)):
    """Get all notes for a prospect"""
    prospect = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if user["role"] not in ["admin", "super_admin"] and prospect["seat_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view notes for this prospect")
    
    notes = await db.notes.find({"prospect_id": prospect_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [NoteResponse(**n) for n in notes]

@api_router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, req: NoteUpdate, user: dict = Depends(get_current_user)):
    """Update a note"""
    note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only the note author or admin can update
    if user["role"] not in ["admin", "super_admin"] and note["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this note")
    
    await db.notes.update_one(
        {"id": note_id},
        {"$set": {"content": req.content, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated = await db.notes.find_one({"id": note_id}, {"_id": 0})
    return NoteResponse(**updated)

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    """Delete a note"""
    note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only the note author or admin can delete
    if user["role"] not in ["admin", "super_admin"] and note["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")
    
    await db.notes.delete_one({"id": note_id})
    return {"message": "Note deleted"}

# ============== ACTIVITY LOGS ==============

@api_router.get("/activity-logs", response_model=List[ActivityLogResponse])
async def list_activity_logs(
    project_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] not in ["admin", "super_admin"]:
        query["seat_id"] = user["id"]
    if project_id:
        query["project_id"] = project_id
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    return [ActivityLogResponse(**log) for log in logs]

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

# ============== SIMULATION MODE ==============

class SimulationResponse(BaseModel):
    simulation_id: str
    status: str
    message: str
    data: Dict[str, Any]

@api_router.get("/simulation/status")
async def get_simulation_status(admin: dict = Depends(require_admin)):
    """Check if a simulation is currently active"""
    simulation = await db.simulations.find_one({"status": "active"}, {"_id": 0})
    if simulation:
        return {
            "active": True,
            "simulation_id": simulation["id"],
            "created_at": simulation["created_at"],
            "data": simulation.get("summary", {})
        }
    return {"active": False}

@api_router.post("/simulation/start", response_model=SimulationResponse)
async def start_simulation(admin: dict = Depends(require_admin)):
    """
    Start a test simulation that creates:
    - 1 dummy project with full scheduler config
    - 1 mail domain with 3 mail IDs
    - 3 dummy seats (assigned to project)
    - 5 prospects per seat (15 total)
    - Auto-schedules all prospects
    - Marks some tasks as sent
    """
    from datetime import timedelta
    import random
    
    # Check if simulation already active
    existing = await db.simulations.find_one({"status": "active"})
    if existing:
        raise HTTPException(status_code=400, detail="A simulation is already running. End it first.")
    
    simulation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # ========== CREATE PROJECT ==========
    project_id = str(uuid.uuid4())
    project_doc = {
        "id": project_id,
        "name": "[SIM] Demo Outreach Campaign",
        "description": "Simulation project for testing the complete workflow",
        "max_mails_per_day_per_mail_id": 5,
        "min_time_gap_minutes": 10,
        "time_jitter_minutes": 5,
        "touchpoints_count": 4,
        "touchpoint_gaps": [0, 3, 7, 14],
        "work_start_time": "09:00",
        "work_end_time": "17:00",
        "working_days": [1, 2, 3, 4, 5],
        "simulation_id": simulation_id,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    await db.projects.insert_one(project_doc)
    
    # ========== CREATE MAIL DOMAIN ==========
    domain_id = str(uuid.uuid4())
    domain_doc = {
        "id": domain_id,
        "domain": "simcompany.test",
        "project_id": project_id,
        "simulation_id": simulation_id,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    await db.mail_domains.insert_one(domain_doc)
    
    # ========== CREATE MAIL IDS ==========
    mail_ids_data = []
    mail_emails = ["alice@simcompany.test", "bob@simcompany.test", "carol@simcompany.test"]
    for email in mail_emails:
        mail_id = str(uuid.uuid4())
        mail_id_doc = {
            "id": mail_id,
            "email": email,
            "domain_id": domain_id,
            "project_id": project_id,
            "seat_id": None,
            "simulation_id": simulation_id,
            "created_at": now.isoformat()
        }
        await db.mail_ids.insert_one(mail_id_doc)
        mail_ids_data.append({"id": mail_id, "email": email})
    
    # ========== CREATE SEATS ==========
    seats_data = []
    seat_names = [
        ("Alex Johnson", "alex.johnson@simcompany.test"),
        ("Morgan Smith", "morgan.smith@simcompany.test"),
        ("Taylor Brown", "taylor.brown@simcompany.test")
    ]
    
    for i, (name, email) in enumerate(seat_names):
        seat_id = str(uuid.uuid4())
        seat_doc = {
            "id": seat_id,
            "email": email,
            "name": name,
            "role": "seat",
            "status": "active",
            "password_hash": hash_password("simpass123"),
            "plain_password": "simpass123",
            "simulation_id": simulation_id,
            "created_at": now.isoformat()
        }
        await db.users.insert_one(seat_doc)
        
        # Assign seat to project
        assignment_doc = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "seat_id": seat_id,
            "simulation_id": simulation_id,
            "assigned_at": now.isoformat()
        }
        await db.project_assignments.insert_one(assignment_doc)
        
        # Assign mail ID to seat
        await db.mail_ids.update_one(
            {"id": mail_ids_data[i]["id"]},
            {"$set": {"seat_id": seat_id}}
        )
        mail_ids_data[i]["seat_id"] = seat_id
        
        seats_data.append({
            "id": seat_id,
            "name": name,
            "email": email,
            "mail_id": mail_ids_data[i]["email"]
        })
    
    # ========== CREATE PROSPECTS ==========
    company_names = [
        "Acme Corp", "TechVentures", "GlobalSoft", "DataDriven Inc", "CloudFirst",
        "InnovateTech", "DigitalEdge", "SmartSolutions", "NextGen Systems", "FutureTech",
        "AlphaWorks", "BetaSystems", "GammaLabs", "DeltaTech", "OmegaCorp"
    ]
    first_names = ["John", "Sarah", "Mike", "Emma", "David", "Lisa", "James", "Anna", "Chris", "Kate",
                   "Tom", "Rachel", "Steve", "Linda", "Mark"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor",
                  "Anderson", "Thomas", "Jackson", "White", "Harris"]
    
    prospects_data = []
    prospect_index = 0
    
    for seat in seats_data:
        for j in range(5):  # 5 prospects per seat
            prospect_id = str(uuid.uuid4())
            company = company_names[prospect_index]
            first = first_names[prospect_index]
            last = last_names[prospect_index]
            
            prospect_doc = {
                "id": prospect_id,
                "project_id": project_id,
                "seat_id": seat["id"],
                "company_name": company,
                "contact_name": f"{first} {last}",
                "email": f"{first.lower()}.{last.lower()}@{company.lower().replace(' ', '')}.com",
                "phone": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                "linkedin": f"linkedin.com/in/{first.lower()}{last.lower()}",
                "title": random.choice(["CEO", "CTO", "VP Sales", "Director", "Manager"]),
                "domain": f"{company.lower().replace(' ', '')}.com",
                "custom_fields": {},
                "status": "new",
                "assigned_mail_id": None,
                "simulation_id": simulation_id,
                "created_at": now.isoformat()
            }
            await db.prospects.insert_one(prospect_doc)
            prospects_data.append({
                "id": prospect_id,
                "company": company,
                "contact": f"{first} {last}",
                "seat_id": seat["id"]
            })
            prospect_index += 1
    
    # ========== SCHEDULE PROSPECTS ==========
    # Use the smart scheduling engine for each seat
    tasks_created = 0
    
    for seat in seats_data:
        seat_mail_id = next((m for m in mail_ids_data if m.get("seat_id") == seat["id"]), None)
        if not seat_mail_id:
            continue
        
        seat_prospects = [p for p in prospects_data if p["seat_id"] == seat["id"]]
        start_date = now + timedelta(days=1)
        
        # Track schedule for this mail ID
        mail_schedule = {}  # {date: [times]}
        
        for prospect in seat_prospects:
            touchpoint_gaps = [0, 3, 7, 14]
            prev_task_date_str = None
            
            for tp_index in range(4):  # 4 touchpoints
                if tp_index == 0:
                    base_date = start_date
                else:
                    prev_task_date = datetime.strptime(prev_task_date_str, "%Y-%m-%d")
                    base_date = prev_task_date + timedelta(days=touchpoint_gaps[tp_index])
                
                # Find working day
                while base_date.isoweekday() > 5:  # Skip weekends
                    base_date += timedelta(days=1)
                
                date_str = base_date.strftime("%Y-%m-%d")
                
                # Find available time slot
                if date_str not in mail_schedule:
                    mail_schedule[date_str] = []
                
                if len(mail_schedule[date_str]) >= 5:  # Max 5 per day
                    base_date += timedelta(days=1)
                    while base_date.isoweekday() > 5:
                        base_date += timedelta(days=1)
                    date_str = base_date.strftime("%Y-%m-%d")
                    mail_schedule[date_str] = []
                
                # Calculate time
                slot_count = len(mail_schedule[date_str])
                hour = 9 + (slot_count * 10 // 60)
                minute = (slot_count * 10) % 60 + random.randint(0, 5)
                time_str = f"{hour:02d}:{minute:02d}"
                mail_schedule[date_str].append(time_str)
                
                task_doc = {
                    "id": str(uuid.uuid4()),
                    "prospect_id": prospect["id"],
                    "seat_id": seat["id"],
                    "project_id": project_id,
                    "step_number": tp_index + 1,
                    "send_date": date_str,
                    "send_time": time_str,
                    "status": "pending",
                    "sent_timestamp": None,
                    "sent_email_content": None,
                    "assigned_mail_id": seat_mail_id["id"],
                    "description": "Intro Email" if tp_index == 0 else f"Follow-up {tp_index}",
                    "simulation_id": simulation_id,
                    "created_at": now.isoformat()
                }
                await db.tasks.insert_one(task_doc)
                tasks_created += 1
                prev_task_date_str = date_str
            
            # Update prospect with assigned mail ID
            await db.prospects.update_one(
                {"id": prospect["id"]},
                {"$set": {"assigned_mail_id": seat_mail_id["id"]}}
            )
    
    # ========== MARK SOME TASKS AS SENT ==========
    # Mark ~30% of intro emails as sent
    intro_tasks = await db.tasks.find({
        "simulation_id": simulation_id,
        "step_number": 1
    }, {"_id": 0}).to_list(100)
    
    tasks_sent = 0
    for task in intro_tasks[:5]:  # Mark first 5 intro emails as sent
        sent_time = now - timedelta(hours=random.randint(1, 24))
        await db.tasks.update_one(
            {"id": task["id"]},
            {"$set": {
                "status": "sent",
                "sent_timestamp": sent_time.isoformat(),
                "sent_email_content": f"Hi {random.choice(first_names)},\n\nI hope this email finds you well. I wanted to reach out about...\n\nBest regards,\n{random.choice([s['name'] for s in seats_data])}"
            }}
        )
        tasks_sent += 1
        
        # Log activity
        log_doc = {
            "id": str(uuid.uuid4()),
            "task_id": task["id"],
            "prospect_id": task["prospect_id"],
            "seat_id": task["seat_id"],
            "project_id": project_id,
            "action": "sent",
            "details": {"sent_timestamp": sent_time.isoformat()},
            "simulation_id": simulation_id,
            "timestamp": sent_time.isoformat()
        }
        await db.activity_logs.insert_one(log_doc)
    
    # ========== SAVE SIMULATION RECORD ==========
    simulation_doc = {
        "id": simulation_id,
        "status": "active",
        "created_by": admin["id"],
        "created_at": now.isoformat(),
        "summary": {
            "project_id": project_id,
            "project_name": "[SIM] Demo Outreach Campaign",
            "domain": "simcompany.test",
            "seats_count": len(seats_data),
            "prospects_count": len(prospects_data),
            "tasks_created": tasks_created,
            "tasks_sent": tasks_sent,
            "seats": seats_data
        }
    }
    await db.simulations.insert_one(simulation_doc)
    
    return SimulationResponse(
        simulation_id=simulation_id,
        status="active",
        message=f"Simulation started! Created {len(seats_data)} seats, {len(prospects_data)} prospects, and {tasks_created} tasks.",
        data=simulation_doc["summary"]
    )

@api_router.post("/simulation/end")
async def end_simulation(admin: dict = Depends(require_admin)):
    """End the active simulation and clean up all simulation data"""
    
    simulation = await db.simulations.find_one({"status": "active"})
    if not simulation:
        raise HTTPException(status_code=404, detail="No active simulation found")
    
    simulation_id = simulation["id"]
    
    # Delete all simulation data
    deleted_counts = {
        "tasks": (await db.tasks.delete_many({"simulation_id": simulation_id})).deleted_count,
        "prospects": (await db.prospects.delete_many({"simulation_id": simulation_id})).deleted_count,
        "activity_logs": (await db.activity_logs.delete_many({"simulation_id": simulation_id})).deleted_count,
        "notes": (await db.notes.delete_many({"simulation_id": simulation_id})).deleted_count,
        "scheduling_reports": (await db.scheduling_reports.delete_many({"simulation_id": simulation_id})).deleted_count,
        "project_assignments": (await db.project_assignments.delete_many({"simulation_id": simulation_id})).deleted_count,
        "mail_ids": (await db.mail_ids.delete_many({"simulation_id": simulation_id})).deleted_count,
        "mail_domains": (await db.mail_domains.delete_many({"simulation_id": simulation_id})).deleted_count,
        "users": (await db.users.delete_many({"simulation_id": simulation_id})).deleted_count,
        "projects": (await db.projects.delete_many({"simulation_id": simulation_id})).deleted_count,
    }
    
    # Mark simulation as ended
    await db.simulations.update_one(
        {"id": simulation_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "message": "Simulation ended and all data cleaned up",
        "simulation_id": simulation_id,
        "deleted": deleted_counts
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
