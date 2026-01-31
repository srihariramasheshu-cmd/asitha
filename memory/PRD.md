# ABM Blinder - Product Requirements Document

## Original Problem Statement
Develop "ABM Blinder," an internal application for managed outbound campaigns with hierarchical structure: Admin -> Project -> Seat -> Prospect -> Outreach. Users: 2 Admins (Global Control), 15 Seats (Project execution).

## User Personas
1. **Admin** - Global campaign control, creates projects, manages seats, uploads schedules, exports reports
2. **Seat** - Executes outbound campaigns, uploads prospects, manages outreach sequences, logs sent emails and replies

## Core Requirements (Static)
- JWT email/password authentication (admin creates accounts)
- MongoDB database
- CSV upload/download for prospects and schedules
- No email integration - just task tracking/logging
- Professional dark theme with readable fonts

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT tokens with bcrypt password hashing
- **Data Models**: Users, Projects, ProjectAssignments, Prospects, OutreachSteps, Tasks, ActivityLogs

## What's Been Implemented (Jan 31, 2026)
### Backend (100% Complete)
- User management (admin/seat roles)
- Project CRUD + seat assignments
- Prospect management with CSV upload/import
- 4-step outreach sequence per prospect
- Task scheduling system (admin uploads CSV)
- Activity logging (sent/reply tracking)
- CSV export for activity and prospects
- Stats overview endpoint

### Frontend (100% Complete)
- Login page with dark industrial theme
- Admin Control Tower dashboard
- Seat Dashboard with daily task queue
- Projects management (create, view, assign seats)
- Seats management (create accounts)
- Prospects page with CSV upload + column mapping
- Prospect detail with 4-step outreach editor
- Tasks page with filters and mark sent/log reply
- Schedule upload page with template download
- Export page for activity and prospects

## Default Credentials
- Admin: admin@abmblinder.com / admin123

## Key Features
1. **CSV Column Mapping** - Auto-detect + manual mapping of CSV headers to schema fields
2. **Task Distribution** - Admin uploads schedule CSV, tasks appear on seat dashboards
3. **Activity Tracking** - Log sent timestamps and reply content
4. **Multi-Tenancy** - Seats only see their assigned projects/prospects

## Prioritized Backlog
### P0 (Complete)
- [x] Auth system
- [x] Project/Seat management
- [x] CSV upload with column mapping
- [x] Task scheduling
- [x] Activity export

### P1 (Next Phase)
- [ ] Email template variables ({{contact_name}}, etc.)
- [ ] Prospect status workflow visualization
- [ ] Task calendar view
- [ ] Bulk operations on prospects

### P2 (Future)
- [ ] Email integration (optional)
- [ ] Analytics dashboard with charts
- [ ] Seat performance metrics
- [ ] Project templates
