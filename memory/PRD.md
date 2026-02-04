# ABM Blinder - Product Requirements Document

## Original Problem Statement
Develop "ABM Blinder," an internal application for managed outbound campaigns with hierarchical structure: Admin -> Project -> Seat -> Prospect -> Outreach. Users: 2 Admins (Global Control), 15 Seats (Project execution).

## User Personas
1. **Super Admin (srihariramasheshu@gmail.com)** - Ultimate control with all powers:
   - Create/manage admins and seats
   - Create/edit/delete all projects
   - Assign seats to any project
   - Create tasks manually for any seat
   - Schedule tasks with custom date/time
   - View all user passwords
   - View all activity logs
   - Export all data
2. **Admin** - Campaign control, creates projects, manages seats, uploads schedules, exports reports
3. **Seat** - Executes outbound campaigns, uploads prospects, manages outreach sequences, logs sent emails and replies

## Core Requirements (Static)
- Self-signup with admin approval workflow
- Super admin can do everything (full CRUD on projects, seats, tasks)
- Admin can see all user passwords (captured during signup)
- Activity logs visible to admins
- Manual task creation for any seat
- MongoDB database
- CSV upload/download for prospects and schedules
- No email integration - just task tracking/logging
- Professional dark theme with readable fonts

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT tokens with bcrypt password hashing
- **Roles**: super_admin, admin, seat, pending
- **Data Models**: Users, Projects, ProjectAssignments, Prospects, OutreachSteps, Tasks, ActivityLogs, Notes

## What's Been Implemented (Feb 4, 2026)

### Backend (100% Complete)
- User self-signup (accounts start as "pending")
- Admin/Super Admin approval workflow
- Role management (super_admin can promote to admin)
- Password storage visible to admins
- Project CRUD + seat assignments
- **Project scheduling settings**: mails_per_domain_per_day, jitter_minutes
- Prospect management with CSV upload/import (Form data with column mapping)
- 4-step outreach sequence per prospect
- **Manual task creation** for any seat by super admin
- **Task deletion** by admin/super admin
- Task scheduling system (CSV upload or manual)
- **Schedule Lever** with smart scheduling:
  - Domain-per-day limits to avoid spam filters
  - Time jitter for natural delivery
- **Task Update with sent_email_content** - Capture actual email content when marking as sent
- **Notes CRUD** - Full CRUD for prospect notes
- Activity logging (sent/reply tracking with email content)
- CSV export for activity and prospects
- Stats overview with pending users count

### Frontend (100% Complete)
- Login page with dark industrial theme
- Signup page with pending approval notice
- Super Admin Control Tower dashboard
- Users & Approvals page (view passwords, approve users, change roles)
- **Task Management page** - Create tasks for any seat with:
  - Seat selection
  - Project selection  
  - Optional prospect linking
  - Step number (1-5)
  - Date picker
  - Time picker
  - Task description
  - Filter by seat/project/status
  - Delete tasks
- Activity Logs page (filter by project/seat)
- Projects management (create, view, assign seats)
- Seats management (view active seats)
- Prospects page with CSV upload + column mapping
- Prospect detail with 4-step outreach editor
- Tasks page for viewing all tasks
- Schedule upload page with template download
- Export page for activity and prospects
- **Schedule Lever page** with:
  - Project selection
  - Start date/time picker
  - Gap between steps slider
  - **Advanced Scheduling section**:
    - Mails per Domain/Day slider (1-50)
    - Time Jitter slider (±0-60 min)
  - Schedule preview
  - Save as project default button
- **Calendar Dashboard** with:
  - Google Calendar-style task view
  - Drag & drop rescheduling
  - Color-coded tasks (blue=intro, violet=follow-up, green=sent)
  - **Task Panel** with:
    - Prospect details (company, contact, email)
    - Task status and timestamps
    - Sent email content display (if captured)
    - **Prospect Notes section**:
      - Add new note textarea
      - Notes list with delete buttons
      - Note author and date display
    - **Mark as Sent modal**:
      - Optional email content capture textarea
      - Confirm sent button

## Default Credentials
- Super Admin: srihariramasheshu@gmail.com / superadmin123

## Key Features
1. **Super Admin Full Powers** - Create projects, seats, tasks, manage everything
2. **Manual Task Creation** - Create tasks for any seat with date/time scheduling
3. **Self-Signup with Approval** - Users signup, admin sees their password and approves
4. **Activity Monitoring** - Admins see all seat activity logs
5. **CSV Column Mapping** - Auto-detect + manual mapping of CSV headers
6. **Task Distribution** - Admin uploads schedule CSV or creates tasks manually
7. **Smart Scheduling (NEW)** - Domain limits and time jitter for natural delivery
8. **Email Content Capture (NEW)** - Store sent email content for reference
9. **Prospect Notes (NEW)** - Add notes to prospects for collaboration

## Prioritized Backlog
### P0 (Complete)
- [x] Self-signup with approval workflow
- [x] Super admin full powers
- [x] Manual task creation for any seat
- [x] Task management page with filters
- [x] Admin password visibility
- [x] Activity logs for admins
- [x] Project/Seat management
- [x] CSV Import with Form data (fixed mappings bug)
- [x] Smart scheduling with domain limits & jitter
- [x] Email content capture on send
- [x] Prospect notes CRUD

### P1 (Next Phase)
- [ ] Email notifications for approval
- [ ] Password reset functionality
- [ ] Bulk task creation
- [ ] In-app analytics for email sequence performance

### P2 (Future)
- [ ] Email integration (optional)
- [ ] Analytics dashboard with charts
- [ ] Seat performance metrics
- [ ] User notifications system

## API Endpoints

### Auth
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User self-signup
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List all users (admin)
- `GET /api/users/pending` - List pending users (admin)
- `GET /api/users/seats` - List active seats (admin)
- `PUT /api/users/{id}/approve` - Approve user (admin)
- `PUT /api/users/{id}/role` - Update role (super_admin)
- `DELETE /api/users/{id}` - Delete user (admin)

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (admin)
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project (includes scheduling settings)
- `DELETE /api/projects/{id}` - Delete project

### Prospects
- `GET /api/prospects` - List prospects
- `POST /api/prospects` - Create prospect
- `POST /api/prospects/upload/parse` - Parse CSV headers
- `POST /api/prospects/upload/import` - Import CSV with Form data

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task (admin)
- `GET /api/tasks/calendar` - Get calendar tasks
- `POST /api/tasks/lever` - Apply schedule lever
- `PUT /api/tasks/{id}` - Update task (includes sent_email_content)
- `DELETE /api/tasks/{id}` - Delete task

### Notes (NEW)
- `POST /api/notes` - Create note
- `GET /api/notes/prospect/{id}` - Get prospect notes
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note

### Activity & Export
- `GET /api/activity-logs` - List activity logs
- `GET /api/export/activity` - Export activity CSV
- `GET /api/export/prospects` - Export prospects CSV

## Database Schema

### New/Updated Collections

**projects** (updated):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "domains": ["string"],
  "gap_days": "int",
  "step_labels": ["string"],
  "mails_per_domain_per_day": "int (default: 10)",
  "jitter_minutes": "int (default: 0)",
  "created_by": "uuid",
  "created_at": "datetime"
}
```

**tasks** (updated):
```json
{
  "id": "uuid",
  "prospect_id": "uuid (optional)",
  "seat_id": "uuid",
  "project_id": "uuid",
  "step_number": "int",
  "send_date": "string (YYYY-MM-DD)",
  "send_time": "string (HH:MM)",
  "status": "string",
  "sent_timestamp": "datetime (optional)",
  "sent_email_content": "string (optional, NEW)",
  "description": "string",
  "created_at": "datetime"
}
```

**notes** (NEW):
```json
{
  "id": "uuid",
  "prospect_id": "uuid",
  "user_id": "uuid",
  "user_name": "string",
  "content": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```
