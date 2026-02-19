# ABM Blinder - Product Requirements Document

## Original Problem Statement
Develop "ABM Blinder," an internal application for managed outbound campaigns with hierarchical structure: Admin -> Project -> Seat -> Prospect -> Outreach.

## Business Rules (Updated Feb 19, 2026)
- **Mail Domain/Mail ID Management:**
  - Admin configures mail domains and mail IDs per project
  - One domain can only be assigned to one project
  - One mail ID can only be assigned to one seat
  - A seat can have multiple mail IDs assigned

- **Scheduler Configuration (per project):**
  - Max mails per day per mail-ID
  - Minimum time gap between mails from same mail-ID
  - Random time jitter for natural delivery
  - Number of touchpoints per sequence
  - Gap in days between each touchpoint
  - Work start/end time
  - Working days (weekdays)

- **Smart Scheduling Engine:**
  - Round-robin mail ID assignment (same mail-ID for all touchpoints of a prospect)
  - Respects all timing constraints (gaps, jitter, max mails/day)
  - Schedules only during work hours on working days
  - Spillover to next available date if day is full
  - Reports prospects that can't be scheduled within 2 weeks

## User Personas
1. **Super Admin (srihariramasheshu@gmail.com)** - Ultimate control
2. **Admin** - Campaign control, project/seat management
3. **Seat** - Executes outbound campaigns, uploads prospects

## Technology Stack
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT tokens with bcrypt password hashing

## What's Been Implemented

### Phase 1: Mail Management & Smart Scheduling (Feb 19, 2026)

**Backend:**
- [x] Mail Domain CRUD (POST/GET/DELETE /api/mail-domains)
- [x] Mail ID CRUD (POST/GET/DELETE /api/mail-ids)
- [x] Mail ID assignment to seats (PUT /api/mail-ids/{id}/assign)
- [x] Enhanced project model with new scheduler fields:
  - `max_mails_per_day_per_mail_id`
  - `min_time_gap_minutes`
  - `time_jitter_minutes`
  - `touchpoints_count`
  - `touchpoint_gaps[]`
  - `work_start_time`, `work_end_time`
  - `working_days[]`
- [x] Config validation endpoint (POST /api/projects/{id}/check-config)
- [x] Smart scheduling endpoint (POST /api/projects/{id}/schedule-prospects)
- [x] Scheduling reports (GET /api/projects/{id}/scheduling-reports)

**Frontend:**
- [x] Mail Management page (/admin/mail-management)
  - Add/delete mail domains
  - Add/delete mail IDs
  - Assign/unassign seats to mail IDs
- [x] Scheduler Configuration page (/admin/schedule-lever)
  - Max mails per day slider
  - Min time gap slider
  - Time jitter slider
  - Touchpoints count slider
  - Touchpoint gaps configuration
  - Work hours inputs
  - Working days selector
- [x] Scheduling page (/scheduling)
  - Config check status
  - Schedule prospects button
  - Scheduling history with detailed reports

**Testing:**
- All 28 backend tests passed (100%)
- Round-robin mail assignment verified
- Time constraints verified (gaps, jitter, work hours)

### Phase 2: Test Simulation Mode (Feb 19, 2026)

**Backend:**
- [x] GET /api/simulation/status - Check if simulation is active
- [x] POST /api/simulation/start - Creates complete test data:
  - 1 project with scheduler config
  - 1 mail domain (simcompany.test)
  - 3 mail IDs assigned to 3 seats
  - 15 prospects (5 per seat)
  - 60 tasks (4 touchpoints per prospect)
  - 5 intro emails pre-marked as sent
- [x] POST /api/simulation/end - Cleans up all simulation data

**Frontend:**
- [x] "Run Test Simulation" button in Admin Dashboard
- [x] "Simulation Mode Active" banner when active
- [x] "View Details" modal with simulation summary
- [x] "End Simulation" button to cleanup

**Testing:**
- All 14 simulation tests passed (100%)
- Full lifecycle verified: start → verify → end → cleanup

### Previous Work (Prior Sessions)
- User authentication with approval workflow
- Project CRUD with seat assignments
- Prospect management with CSV import
- Calendar dashboard with drag-drop
- Task management with status tracking
- Activity logging
- Notes system for prospects

## Key API Endpoints

### Simulation Mode (NEW)
- `GET /api/simulation/status` - Check if simulation active
- `POST /api/simulation/start` - Start simulation with dummy data
- `POST /api/simulation/end` - End simulation and cleanup

### Mail Management (NEW)
- `POST /api/mail-domains` - Create mail domain
- `GET /api/mail-domains` - List all domains
- `GET /api/projects/{id}/mail-domains` - Project domains
- `DELETE /api/mail-domains/{id}` - Delete domain

- `POST /api/mail-ids` - Create mail ID
- `GET /api/mail-ids` - List mail IDs
- `PUT /api/mail-ids/{id}/assign` - Assign to seat
- `DELETE /api/mail-ids/{id}` - Delete mail ID

### Scheduling (NEW)
- `POST /api/projects/{id}/check-config` - Validate config
- `POST /api/projects/{id}/schedule-prospects` - Run scheduler
- `GET /api/projects/{id}/scheduling-reports` - Get reports

### Existing Endpoints
- Auth: `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`
- Users: `/api/users`, `/api/users/pending`, `/api/users/{id}/approve`
- Projects: `/api/projects` CRUD
- Prospects: `/api/prospects` CRUD, `/api/prospects/upload/import`
- Tasks: `/api/tasks`, `/api/tasks/calendar`
- Notes: `/api/notes`
- Activity: `/api/activity-logs`

## Database Schema

### New Collections

**mail_domains:**
```json
{
  "id": "uuid",
  "domain": "string (unique)",
  "project_id": "uuid",
  "created_by": "uuid",
  "created_at": "datetime"
}
```

**mail_ids:**
```json
{
  "id": "uuid",
  "email": "string (unique)",
  "domain_id": "uuid",
  "project_id": "uuid",
  "seat_id": "uuid (nullable)",
  "created_at": "datetime"
}
```

**scheduling_reports:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "seat_id": "uuid",
  "total_prospects": "int",
  "scheduled_prospects": "int",
  "failed_prospects": "int",
  "total_tasks_created": "int",
  "report_data": "object",
  "created_at": "datetime"
}
```

### Updated Collections

**projects:** Added fields:
- `max_mails_per_day_per_mail_id`
- `min_time_gap_minutes`
- `time_jitter_minutes`
- `touchpoints_count`
- `touchpoint_gaps[]`
- `work_start_time`
- `work_end_time`
- `working_days[]`

**prospects:** Added `assigned_mail_id`

**tasks:** Added `assigned_mail_id`, `assigned_mail_email`

## Prioritized Backlog

### P0 (Complete)
- [x] Mail domain/ID management
- [x] Scheduler configuration
- [x] Smart scheduling engine
- [x] Scheduling reports

### P1 (Next Phase)
- [ ] Email template management per project
- [ ] User notifications (account approval, etc.)
- [ ] Analytics for email sequence performance

### P2 (Future)
- [ ] Bulk mail ID import
- [ ] Analytics dashboard with charts
- [ ] Email integration (actual sending)
- [ ] Backend refactoring (modularize server.py)

## Default Credentials
- Super Admin: srihariramasheshu@gmail.com / superadmin123

## Test Reports
- /app/test_reports/iteration_5.json (Phase 2 - Simulation - 14 tests passed)
- /app/test_reports/iteration_4.json (Phase 1 - Mail Management - 28 tests passed)
- /app/test_reports/iteration_3.json (Previous session)
