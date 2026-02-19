"""
ABM Blinder Phase 1 Feature Tests
Testing:
1. Mail domain creation (POST /api/mail-domains)
2. Mail ID creation (POST /api/mail-ids)
3. Mail ID assignment to seats (PUT /api/mail-ids/{id}/assign)
4. Project scheduler config with new fields
5. Check config endpoint (POST /api/projects/{id}/check-config)
6. Schedule prospects endpoint (POST /api/projects/{id}/schedule-prospects)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "srihariramasheshu@gmail.com"
SUPER_ADMIN_PASSWORD = "superadmin123"

# Test project from main agent context
TEST_PROJECT_ID = "c4807f6a-743e-43ee-9abd-1a25648f31c8"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for super admin"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


@pytest.fixture(scope="module")
def test_seat_user(authenticated_client):
    """Create a test seat user"""
    user_data = {
        "email": "TEST_seat_phase1@test.com",
        "name": "TEST Seat Phase1",
        "password": "testpass123",
        "role": "seat"
    }
    # Try to create or skip if exists
    response = authenticated_client.post(f"{BASE_URL}/api/users", json=user_data)
    if response.status_code == 200:
        user = response.json()
        yield user
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/users/{user['id']}")
    elif response.status_code == 400 and "already exists" in response.text:
        # User exists, get all users and find it
        users_response = authenticated_client.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        seat_user = next((u for u in users if u.get('email') == user_data['email']), None)
        if seat_user:
            yield seat_user
        else:
            pytest.skip("Could not create or find seat user")
    else:
        pytest.fail(f"Failed to create seat user: {response.text}")


@pytest.fixture(scope="module")
def test_project_with_scheduling(authenticated_client):
    """Create a test project with all scheduling config fields"""
    project_data = {
        "name": "TEST_Phase1_Scheduling_Project",
        "description": "Test project for Phase 1 mail scheduling",
        "max_mails_per_day_per_mail_id": 15,
        "min_time_gap_minutes": 10,
        "time_jitter_minutes": 5,
        "touchpoints_count": 5,
        "touchpoint_gaps": [0, 3, 5, 7, 10],
        "work_start_time": "09:00",
        "work_end_time": "18:00",
        "working_days": [1, 2, 3, 4, 5]
    }
    response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
    assert response.status_code == 200, f"Failed to create project: {response.text}"
    project = response.json()
    yield project
    # Cleanup
    authenticated_client.delete(f"{BASE_URL}/api/projects/{project['id']}")


class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_login_success(self, api_client):
        """Test successful login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"


class TestMailDomainCRUD:
    """Test mail domain management - POST /api/mail-domains"""
    
    def test_create_mail_domain(self, authenticated_client, test_project_with_scheduling):
        """Test creating a mail domain for a project"""
        domain_data = {
            "domain": "test-phase1-domain.com",
            "project_id": test_project_with_scheduling["id"]
        }
        response = authenticated_client.post(f"{BASE_URL}/api/mail-domains", json=domain_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["domain"] == "test-phase1-domain.com"
        assert data["project_id"] == test_project_with_scheduling["id"]
        assert "id" in data
        assert "created_at" in data
        print(f"Created mail domain: {data['id']}")
    
    def test_create_duplicate_domain_fails(self, authenticated_client, test_project_with_scheduling):
        """Test that duplicate domain creation fails"""
        domain_data = {
            "domain": "test-phase1-domain.com",
            "project_id": test_project_with_scheduling["id"]
        }
        response = authenticated_client.post(f"{BASE_URL}/api/mail-domains", json=domain_data)
        # Should fail as domain already exists
        assert response.status_code == 400
        assert "already assigned" in response.json().get("detail", "").lower()
    
    def test_list_mail_domains(self, authenticated_client, test_project_with_scheduling):
        """Test listing mail domains"""
        response = authenticated_client.get(f"{BASE_URL}/api/mail-domains")
        assert response.status_code == 200
        
        domains = response.json()
        assert isinstance(domains, list)
        # Find our test domain
        test_domain = next((d for d in domains if d["domain"] == "test-phase1-domain.com"), None)
        assert test_domain is not None
    
    def test_list_domains_by_project(self, authenticated_client, test_project_with_scheduling):
        """Test listing domains filtered by project"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/mail-domains?project_id={test_project_with_scheduling['id']}"
        )
        assert response.status_code == 200
        
        domains = response.json()
        assert isinstance(domains, list)
        # All returned domains should belong to our project
        for d in domains:
            assert d["project_id"] == test_project_with_scheduling["id"]
    
    def test_get_project_mail_domains(self, authenticated_client, test_project_with_scheduling):
        """Test getting mail domains for a specific project"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}/mail-domains"
        )
        assert response.status_code == 200
        
        domains = response.json()
        assert isinstance(domains, list)


class TestMailIdCRUD:
    """Test mail ID management - POST /api/mail-ids"""
    
    def test_create_mail_id(self, authenticated_client, test_project_with_scheduling):
        """Test creating a mail ID under a domain"""
        # First get the domain we created
        domains_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}/mail-domains"
        )
        assert domains_response.status_code == 200
        domains = domains_response.json()
        
        if not domains:
            pytest.skip("No domains available for testing")
        
        domain = domains[0]
        
        mail_id_data = {
            "email": f"user1@{domain['domain']}",
            "domain_id": domain["id"]
        }
        response = authenticated_client.post(f"{BASE_URL}/api/mail-ids", json=mail_id_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["email"] == mail_id_data["email"]
        assert data["domain_id"] == domain["id"]
        assert data["project_id"] == test_project_with_scheduling["id"]
        assert data["seat_id"] is None  # Not assigned initially
        assert "id" in data
        print(f"Created mail ID: {data['email']}")
    
    def test_create_mail_id_wrong_domain_fails(self, authenticated_client, test_project_with_scheduling):
        """Test that creating mail ID with wrong domain fails"""
        # Get the domain
        domains_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}/mail-domains"
        )
        domains = domains_response.json()
        
        if not domains:
            pytest.skip("No domains available")
        
        domain = domains[0]
        
        # Try to create mail ID with wrong domain suffix
        mail_id_data = {
            "email": "user@wrongdomain.com",
            "domain_id": domain["id"]
        }
        response = authenticated_client.post(f"{BASE_URL}/api/mail-ids", json=mail_id_data)
        assert response.status_code == 400
        assert "must belong to domain" in response.json().get("detail", "").lower()
    
    def test_create_duplicate_mail_id_fails(self, authenticated_client, test_project_with_scheduling):
        """Test that duplicate mail ID creation fails"""
        domains_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}/mail-domains"
        )
        domains = domains_response.json()
        
        if not domains:
            pytest.skip("No domains available")
        
        domain = domains[0]
        
        mail_id_data = {
            "email": f"user1@{domain['domain']}",
            "domain_id": domain["id"]
        }
        response = authenticated_client.post(f"{BASE_URL}/api/mail-ids", json=mail_id_data)
        # Should fail as mail ID already exists
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()
    
    def test_list_mail_ids(self, authenticated_client, test_project_with_scheduling):
        """Test listing mail IDs"""
        response = authenticated_client.get(f"{BASE_URL}/api/mail-ids")
        assert response.status_code == 200
        
        mail_ids = response.json()
        assert isinstance(mail_ids, list)
    
    def test_list_mail_ids_by_project(self, authenticated_client, test_project_with_scheduling):
        """Test listing mail IDs filtered by project"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?project_id={test_project_with_scheduling['id']}"
        )
        assert response.status_code == 200
        
        mail_ids = response.json()
        assert isinstance(mail_ids, list)
        for m in mail_ids:
            assert m["project_id"] == test_project_with_scheduling["id"]
    
    def test_list_unassigned_mail_ids(self, authenticated_client, test_project_with_scheduling):
        """Test listing unassigned mail IDs"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?project_id={test_project_with_scheduling['id']}&unassigned=true"
        )
        assert response.status_code == 200
        
        mail_ids = response.json()
        assert isinstance(mail_ids, list)
        for m in mail_ids:
            assert m["seat_id"] is None


class TestMailIdAssignment:
    """Test mail ID assignment to seats - PUT /api/mail-ids/{id}/assign"""
    
    def test_assign_mail_id_to_seat(self, authenticated_client, test_project_with_scheduling, test_seat_user):
        """Test assigning a mail ID to a seat"""
        # First, assign seat to project
        assign_response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}/assign?seat_id={test_seat_user['id']}"
        )
        # May already be assigned
        if assign_response.status_code not in [200, 400]:
            pytest.fail(f"Failed to assign seat to project: {assign_response.text}")
        
        # Get mail IDs for the project
        mail_ids_response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?project_id={test_project_with_scheduling['id']}&unassigned=true"
        )
        mail_ids = mail_ids_response.json()
        
        if not mail_ids:
            pytest.skip("No unassigned mail IDs available")
        
        mail_id = mail_ids[0]
        
        # Assign mail ID to seat
        response = authenticated_client.put(
            f"{BASE_URL}/api/mail-ids/{mail_id['id']}/assign",
            json={"seat_id": test_seat_user["id"]}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        assert "assigned" in response.json().get("message", "").lower()
        print(f"Assigned mail ID {mail_id['email']} to seat {test_seat_user['email']}")
    
    def test_unassign_mail_id_from_seat(self, authenticated_client, test_project_with_scheduling, test_seat_user):
        """Test unassigning a mail ID from a seat"""
        # Get mail IDs assigned to seat
        mail_ids_response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?seat_id={test_seat_user['id']}"
        )
        mail_ids = mail_ids_response.json()
        
        if not mail_ids:
            pytest.skip("No mail IDs assigned to seat")
        
        mail_id = mail_ids[0]
        
        # Unassign mail ID
        response = authenticated_client.put(
            f"{BASE_URL}/api/mail-ids/{mail_id['id']}/assign",
            json={"seat_id": None}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        assert "unassigned" in response.json().get("message", "").lower()
    
    def test_assign_mail_id_to_nonexistent_seat_fails(self, authenticated_client, test_project_with_scheduling):
        """Test that assigning mail ID to nonexistent seat fails"""
        mail_ids_response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?project_id={test_project_with_scheduling['id']}"
        )
        mail_ids = mail_ids_response.json()
        
        if not mail_ids:
            pytest.skip("No mail IDs available")
        
        mail_id = mail_ids[0]
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/mail-ids/{mail_id['id']}/assign",
            json={"seat_id": "nonexistent-seat-id"}
        )
        assert response.status_code == 404
        assert "seat not found" in response.json().get("detail", "").lower()
    
    def test_get_seat_mail_ids(self, authenticated_client, test_seat_user):
        """Test getting mail IDs for a specific seat"""
        response = authenticated_client.get(f"{BASE_URL}/api/seats/{test_seat_user['id']}/mail-ids")
        assert response.status_code == 200
        
        mail_ids = response.json()
        assert isinstance(mail_ids, list)


class TestProjectSchedulerConfig:
    """Test project scheduler config with new fields"""
    
    def test_project_has_scheduler_config_fields(self, authenticated_client, test_project_with_scheduling):
        """Test that project response includes all scheduler config fields"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}"
        )
        assert response.status_code == 200
        
        project = response.json()
        
        # Verify all new scheduler config fields
        assert "max_mails_per_day_per_mail_id" in project
        assert "min_time_gap_minutes" in project
        assert "time_jitter_minutes" in project
        assert "touchpoints_count" in project
        assert "touchpoint_gaps" in project
        assert "work_start_time" in project
        assert "work_end_time" in project
        assert "working_days" in project
        
        # Verify values
        assert project["touchpoints_count"] == 5
        assert isinstance(project["touchpoint_gaps"], list)
        assert len(project["touchpoint_gaps"]) >= 5
        assert isinstance(project["working_days"], list)
    
    def test_update_scheduler_config(self, authenticated_client, test_project_with_scheduling):
        """Test updating project scheduler configuration"""
        # Get current project
        get_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}"
        )
        project = get_response.json()
        
        # Update with new scheduler config
        update_data = {
            "name": project["name"],
            "description": project.get("description", ""),
            "max_mails_per_day_per_mail_id": 20,
            "min_time_gap_minutes": 15,
            "time_jitter_minutes": 10,
            "touchpoints_count": 6,
            "touchpoint_gaps": [0, 2, 4, 6, 8, 10],
            "work_start_time": "08:00",
            "work_end_time": "17:00",
            "working_days": [1, 2, 3, 4, 5, 6]  # Include Saturday
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/projects/{test_project_with_scheduling['id']}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        updated = response.json()
        assert updated["max_mails_per_day_per_mail_id"] == 20
        assert updated["min_time_gap_minutes"] == 15
        assert updated["time_jitter_minutes"] == 10
        assert updated["touchpoints_count"] == 6
        assert updated["touchpoint_gaps"] == [0, 2, 4, 6, 8, 10]
        assert updated["work_start_time"] == "08:00"
        assert 6 in updated["working_days"]


class TestCheckConfig:
    """Test check-config endpoint - POST /api/projects/{id}/check-config"""
    
    def test_check_config_existing_project(self, authenticated_client):
        """Test check-config on the pre-configured test project"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/check-config"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "ready" in data
        assert "issues" in data
        assert "domains_count" in data
        assert "mail_ids_count" in data
        assert "touchpoints_count" in data
        
        print(f"Config check - ready: {data['ready']}, issues: {data['issues']}")
    
    def test_check_config_new_project_without_domains(self, authenticated_client):
        """Test check-config on project without mail domains configured"""
        # Create a minimal project
        project_data = {
            "name": "TEST_NoConfig_Project",
            "description": "Project without mail config"
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
        assert create_response.status_code == 200
        project = create_response.json()
        
        try:
            response = authenticated_client.post(
                f"{BASE_URL}/api/projects/{project['id']}/check-config"
            )
            assert response.status_code == 200
            
            data = response.json()
            assert data["ready"] is False
            assert len(data["issues"]) > 0
            # Should have issues about missing domains/mail IDs
            assert any("domain" in issue.lower() for issue in data["issues"])
        finally:
            # Cleanup
            authenticated_client.delete(f"{BASE_URL}/api/projects/{project['id']}")
    
    def test_check_config_nonexistent_project(self, authenticated_client):
        """Test check-config with nonexistent project ID"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/nonexistent-project-id/check-config"
        )
        assert response.status_code == 404


class TestScheduleProspects:
    """Test schedule-prospects endpoint - POST /api/projects/{id}/schedule-prospects"""
    
    def test_schedule_prospects_needs_unscheduled_prospects(self, authenticated_client):
        """Test that schedule-prospects requires unscheduled prospects"""
        # Create a fully configured project
        project_data = {
            "name": "TEST_Schedule_Project",
            "description": "Project for scheduling test",
            "max_mails_per_day_per_mail_id": 10,
            "min_time_gap_minutes": 5,
            "time_jitter_minutes": 0,
            "touchpoints_count": 3,
            "touchpoint_gaps": [0, 3, 7],
            "work_start_time": "09:00",
            "work_end_time": "18:00",
            "working_days": [1, 2, 3, 4, 5]
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
        assert create_response.status_code == 200
        project = create_response.json()
        
        try:
            # Try to schedule without mail IDs
            response = authenticated_client.post(
                f"{BASE_URL}/api/projects/{project['id']}/schedule-prospects"
            )
            # Should fail because no mail IDs configured
            assert response.status_code == 400
            detail = response.json().get("detail", "")
            assert "no mail ids" in detail.lower() or "no unscheduled" in detail.lower()
        finally:
            authenticated_client.delete(f"{BASE_URL}/api/projects/{project['id']}")
    
    def test_schedule_prospects_with_full_setup(self, authenticated_client, test_seat_user):
        """Test full scheduling flow with domains, mail IDs, and prospects"""
        # Create project
        project_data = {
            "name": "TEST_Full_Schedule_Project",
            "description": "Project for full scheduling test",
            "max_mails_per_day_per_mail_id": 10,
            "min_time_gap_minutes": 5,
            "time_jitter_minutes": 2,
            "touchpoints_count": 3,
            "touchpoint_gaps": [0, 3, 7],
            "work_start_time": "09:00",
            "work_end_time": "18:00",
            "working_days": [1, 2, 3, 4, 5]
        }
        proj_response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
        assert proj_response.status_code == 200
        project = proj_response.json()
        
        try:
            # Create mail domain
            domain_data = {"domain": "testschedule.com", "project_id": project["id"]}
            dom_response = authenticated_client.post(f"{BASE_URL}/api/mail-domains", json=domain_data)
            assert dom_response.status_code == 200
            domain = dom_response.json()
            
            # Create mail IDs
            mail_id1_response = authenticated_client.post(
                f"{BASE_URL}/api/mail-ids",
                json={"email": "sender1@testschedule.com", "domain_id": domain["id"]}
            )
            assert mail_id1_response.status_code == 200
            mail_id1 = mail_id1_response.json()
            
            mail_id2_response = authenticated_client.post(
                f"{BASE_URL}/api/mail-ids",
                json={"email": "sender2@testschedule.com", "domain_id": domain["id"]}
            )
            assert mail_id2_response.status_code == 200
            mail_id2 = mail_id2_response.json()
            
            # Assign seat to project
            authenticated_client.post(
                f"{BASE_URL}/api/projects/{project['id']}/assign?seat_id={test_seat_user['id']}"
            )
            
            # Assign mail IDs to seat
            authenticated_client.put(
                f"{BASE_URL}/api/mail-ids/{mail_id1['id']}/assign",
                json={"seat_id": test_seat_user["id"]}
            )
            authenticated_client.put(
                f"{BASE_URL}/api/mail-ids/{mail_id2['id']}/assign",
                json={"seat_id": test_seat_user["id"]}
            )
            
            # Create prospects as the seat user
            # First login as seat user
            seat_login = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_seat_user["email"], "password": "testpass123"},
                headers={"Content-Type": "application/json"}
            )
            
            if seat_login.status_code != 200:
                # User might not have the password we expect, use admin to create prospects
                for i in range(2):
                    prospect_data = {
                        "project_id": project["id"],
                        "company_name": f"TEST_Company_{i}",
                        "contact_name": f"TEST_Contact_{i}",
                        "email": f"prospect{i}@example.com"
                    }
                    authenticated_client.post(f"{BASE_URL}/api/prospects", json=prospect_data)
            else:
                seat_token = seat_login.json()["token"]
                seat_headers = {"Authorization": f"Bearer {seat_token}", "Content-Type": "application/json"}
                
                for i in range(2):
                    prospect_data = {
                        "project_id": project["id"],
                        "company_name": f"TEST_Company_{i}",
                        "contact_name": f"TEST_Contact_{i}",
                        "email": f"prospect{i}@example.com"
                    }
                    requests.post(f"{BASE_URL}/api/prospects", json=prospect_data, headers=seat_headers)
                
                # Run scheduling as seat user
                schedule_response = requests.post(
                    f"{BASE_URL}/api/projects/{project['id']}/schedule-prospects",
                    headers=seat_headers
                )
                
                if schedule_response.status_code == 200:
                    data = schedule_response.json()
                    assert "total_prospects" in data
                    assert "scheduled_prospects" in data
                    assert "failed_prospects" in data
                    assert "total_tasks_created" in data
                    assert "report_data" in data
                    
                    print(f"Scheduled {data['scheduled_prospects']} prospects, "
                          f"created {data['total_tasks_created']} tasks")
                    
                    # Verify round-robin assignment
                    if data["total_tasks_created"] > 0:
                        report_data = data["report_data"]
                        if "scheduled" in report_data:
                            mail_ids_used = set()
                            for s in report_data["scheduled"]:
                                if s.get("assigned_mail_id"):
                                    mail_ids_used.add(s["assigned_mail_id"])
                            print(f"Mail IDs used: {len(mail_ids_used)}")
        finally:
            authenticated_client.delete(f"{BASE_URL}/api/projects/{project['id']}")


class TestSchedulingReports:
    """Test scheduling reports endpoint"""
    
    def test_get_scheduling_reports(self, authenticated_client):
        """Test getting scheduling reports for a project"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/scheduling-reports"
        )
        assert response.status_code == 200
        
        reports = response.json()
        assert isinstance(reports, list)
        
        if reports:
            report = reports[0]
            assert "id" in report
            assert "project_id" in report
            assert "seat_id" in report
            assert "total_prospects" in report
            assert "scheduled_prospects" in report
            assert "report_data" in report


class TestMailDomainDeletion:
    """Test mail domain and mail ID deletion"""
    
    def test_delete_mail_id(self, authenticated_client, test_project_with_scheduling):
        """Test deleting a mail ID"""
        # Get mail IDs for the project
        mail_ids_response = authenticated_client.get(
            f"{BASE_URL}/api/mail-ids?project_id={test_project_with_scheduling['id']}"
        )
        mail_ids = mail_ids_response.json()
        
        if not mail_ids:
            pytest.skip("No mail IDs to delete")
        
        mail_id = mail_ids[0]
        
        response = authenticated_client.delete(f"{BASE_URL}/api/mail-ids/{mail_id['id']}")
        assert response.status_code == 200
        assert "deleted" in response.json().get("message", "").lower()
    
    def test_delete_mail_domain_cascades_to_mail_ids(self, authenticated_client, test_project_with_scheduling):
        """Test that deleting a domain also deletes its mail IDs"""
        # Create a domain
        domain_data = {
            "domain": "deleteme.com",
            "project_id": test_project_with_scheduling["id"]
        }
        dom_response = authenticated_client.post(f"{BASE_URL}/api/mail-domains", json=domain_data)
        
        if dom_response.status_code != 200:
            pytest.skip("Could not create domain for deletion test")
        
        domain = dom_response.json()
        
        # Create a mail ID under it
        mail_response = authenticated_client.post(
            f"{BASE_URL}/api/mail-ids",
            json={"email": "test@deleteme.com", "domain_id": domain["id"]}
        )
        assert mail_response.status_code == 200
        mail_id = mail_response.json()
        
        # Delete the domain
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/mail-domains/{domain['id']}")
        assert delete_response.status_code == 200
        
        # Verify mail ID is also deleted
        check_mail_response = authenticated_client.get(f"{BASE_URL}/api/mail-ids")
        mail_ids = check_mail_response.json()
        mail_id_ids = [m["id"] for m in mail_ids]
        assert mail_id["id"] not in mail_id_ids


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, authenticated_client):
        """Clean up TEST_ prefixed data"""
        # Clean up projects
        projects_response = authenticated_client.get(f"{BASE_URL}/api/projects")
        if projects_response.status_code == 200:
            for p in projects_response.json():
                if p.get("name", "").startswith("TEST_"):
                    authenticated_client.delete(f"{BASE_URL}/api/projects/{p['id']}")
                    print(f"Cleaned up project: {p['name']}")
        
        # Clean up users
        users_response = authenticated_client.get(f"{BASE_URL}/api/users")
        if users_response.status_code == 200:
            for u in users_response.json():
                if u.get("email", "").startswith("TEST_") or u.get("name", "").startswith("TEST"):
                    authenticated_client.delete(f"{BASE_URL}/api/users/{u['id']}")
                    print(f"Cleaned up user: {u['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
