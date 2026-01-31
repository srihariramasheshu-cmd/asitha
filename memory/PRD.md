# ABM Blinder - Product Requirements Document

## Original Problem Statement
Develop "ABM Blinder," an internal application for managed outbound campaigns with hierarchical structure: Admin -> Project -> Seat -> Prospect -> Outreach. Users: 2 Admins (Global Control), 15 Seats (Project execution).

## User Personas
1. **Super Admin (srihariramasheshu@gmail.com)** - Ultimate control, can create admins and seats, view all passwords, approve signups
2. **Admin** - Campaign control, creates projects, manages seats, uploads schedules, exports reports
3. **Seat** - Executes outbound campaigns, uploads prospects, manages outreach sequences, logs sent emails and replies

## Core Requirements (Static)
- Self-signup with admin approval workflow
- Super admin can promote users to Admin or Seat role
- Admin can see all user passwords (captured during signup)
- Activity logs visible to admins
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
- Task scheduling system (admin uploads CSV)
- Activity logging (sent/reply tracking)
- CSV export for activity and prospects
- Stats overview endpoint with pending users count

### Frontend (100% Complete)
- Login page with dark industrial theme
- Signup page with pending approval notice
- Super Admin Control Tower dashboard with pending approvals
- Users & Approvals page (view passwords, approve users, change roles)
- Activity Logs page (filter by project/seat)
- Projects management (create, view, assign seats)
- Seats management (view active seats)
- Prospects page with CSV upload + column mapping
- Prospect detail with 4-step outreach editor
- Tasks page with filters and mark sent/log reply
- Schedule upload page with template download
- Export page for activity and prospects

## Default Credentials
- Super Admin: srihariramasheshu@gmail.com / superadmin123

## Key Features
1. **Self-Signup with Approval** - Users signup, admin sees their password and approves
2. **Role Hierarchy** - Super Admin > Admin > Seat
3. **Activity Monitoring** - Admins see all seat activity logs
4. **CSV Column Mapping** - Auto-detect + manual mapping of CSV headers
5. **Task Distribution** - Admin uploads schedule CSV, tasks appear on seat dashboards

## Prioritized Backlog
### P0 (Complete)
- [x] Self-signup with approval workflow
- [x] Super admin role for srihariramasheshu@gmail.com
- [x] Admin password visibility
- [x] Activity logs for admins
- [x] Project/Seat management
- [x] CSV upload with column mapping
- [x] Task scheduling

### P1 (Next Phase)
- [ ] Email notifications for approval
- [ ] Password reset functionality
- [ ] Email template variables
- [ ] Prospect status workflow visualization

### P2 (Future)
- [ ] Email integration (optional)
- [ ] Analytics dashboard with charts
- [ ] Seat performance metrics
