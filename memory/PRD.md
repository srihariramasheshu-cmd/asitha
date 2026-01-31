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
- **Data Models**: Users, Projects, ProjectAssignments, Prospects, OutreachSteps, Tasks, ActivityLogs

## What's Been Implemented (Jan 31, 2026)
### Backend (100% Complete)
- User self-signup (accounts start as "pending")
- Admin/Super Admin approval workflow
- Role management (super_admin can promote to admin)
- Password storage visible to admins
- Project CRUD + seat assignments
- Prospect management with CSV upload/import
- 4-step outreach sequence per prospect
- **Manual task creation** for any seat by super admin
- **Task deletion** by admin/super admin
- Task scheduling system (CSV upload or manual)
- Activity logging (sent/reply tracking)
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
  - Step number (1-4)
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

## Default Credentials
- Super Admin: srihariramasheshu@gmail.com / superadmin123

## Key Features
1. **Super Admin Full Powers** - Create projects, seats, tasks, manage everything
2. **Manual Task Creation** - Create tasks for any seat with date/time scheduling
3. **Self-Signup with Approval** - Users signup, admin sees their password and approves
4. **Activity Monitoring** - Admins see all seat activity logs
5. **CSV Column Mapping** - Auto-detect + manual mapping of CSV headers
6. **Task Distribution** - Admin uploads schedule CSV or creates tasks manually

## Prioritized Backlog
### P0 (Complete)
- [x] Self-signup with approval workflow
- [x] Super admin full powers
- [x] Manual task creation for any seat
- [x] Task management page with filters
- [x] Admin password visibility
- [x] Activity logs for admins
- [x] Project/Seat management

### P1 (Next Phase)
- [ ] Email notifications for approval
- [ ] Password reset functionality
- [ ] Bulk task creation
- [ ] Task calendar view

### P2 (Future)
- [ ] Email integration (optional)
- [ ] Analytics dashboard with charts
- [ ] Seat performance metrics
