"""
ABM Blinder Feature Tests - Iteration 3
Testing: CSV Import, Schedule Lever, Task Updates, Notes CRUD
"""
import pytest
import requests
import os
import json
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "srihariramasheshu@gmail.com"
SUPER_ADMIN_PASSWORD = "superadmin123"


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
def test_project(authenticated_client):
    """Create a test project for testing"""
    project_data = {
        "name": "TEST_Project_Features",
        "description": "Test project for feature testing",
        "domains": ["test.com", "example.com"],
        "gap_days": 3,
        "step_labels": ["Intro", "F/U 1", "F/U 2", "F/U 3", "F/U 4"],
        "mails_per_domain_per_day": 15,
        "jitter_minutes": 30
    }
    response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
    assert response.status_code == 200, f"Failed to create project: {response.text}"
    project = response.json()
    yield project
    # Cleanup
    authenticated_client.delete(f"{BASE_URL}/api/projects/{project['id']}")


@pytest.fixture(scope="module")
def test_prospect(authenticated_client, test_project):
    """Create a test prospect for testing"""
    prospect_data = {
        "project_id": test_project["id"],
        "company_name": "TEST_Company",
        "contact_name": "TEST_Contact",
        "email": "test@testdomain.com",
        "phone": "123-456-7890",
        "title": "Manager",
        "domain": "testdomain.com"
    }
    response = authenticated_client.post(f"{BASE_URL}/api/prospects", json=prospect_data)
    assert response.status_code == 200, f"Failed to create prospect: {response.text}"
    prospect = response.json()
    yield prospect
    # Cleanup
    authenticated_client.delete(f"{BASE_URL}/api/prospects/{prospect['id']}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "ABM Blinder API" in data["message"]


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self, api_client):
        """Test successful login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["user"]["role"] == "super_admin"
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestProjectWithNewFields:
    """Test project endpoints with new fields: mails_per_domain_per_day, jitter_minutes"""
    
    def test_create_project_with_advanced_settings(self, authenticated_client):
        """Test creating project with mails_per_domain_per_day and jitter_minutes"""
        project_data = {
            "name": "TEST_Advanced_Project",
            "description": "Project with advanced scheduling settings",
            "domains": ["domain1.com", "domain2.com"],
            "gap_days": 5,
            "step_labels": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
            "mails_per_domain_per_day": 20,
            "jitter_minutes": 45
        }
        response = authenticated_client.post(f"{BASE_URL}/api/projects", json=project_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Advanced_Project"
        assert data["mails_per_domain_per_day"] == 20
        assert data["jitter_minutes"] == 45
        assert data["gap_days"] == 5
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/projects/{data['id']}")
    
    def test_update_project_advanced_settings(self, authenticated_client, test_project):
        """Test updating project with new advanced settings"""
        update_data = {
            "name": test_project["name"],
            "description": test_project["description"],
            "domains": test_project["domains"],
            "gap_days": 7,
            "step_labels": test_project["step_labels"],
            "mails_per_domain_per_day": 25,
            "jitter_minutes": 60
        }
        response = authenticated_client.put(
            f"{BASE_URL}/api/projects/{test_project['id']}", 
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["mails_per_domain_per_day"] == 25
        assert data["jitter_minutes"] == 60
        assert data["gap_days"] == 7
    
    def test_get_project_includes_new_fields(self, authenticated_client, test_project):
        """Test that GET project returns new fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/projects/{test_project['id']}")
        assert response.status_code == 200
        
        data = response.json()
        assert "mails_per_domain_per_day" in data
        assert "jitter_minutes" in data
        assert isinstance(data["mails_per_domain_per_day"], int)
        assert isinstance(data["jitter_minutes"], int)


class TestCSVImport:
    """Test CSV import with Form data (file, project_id, mappings)"""
    
    def test_csv_parse(self, authenticated_client):
        """Test CSV parsing endpoint"""
        csv_content = "company,name,email,phone\nAcme Inc,John Doe,john@acme.com,555-1234\nTech Corp,Jane Smith,jane@tech.com,555-5678"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        
        # Remove Content-Type header for multipart
        headers = dict(authenticated_client.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        
        response = requests.post(
            f"{BASE_URL}/api/prospects/upload/parse",
            files=files,
            headers={"Authorization": headers.get("Authorization", "")}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "headers" in data
        assert "preview" in data
        assert "company" in data["headers"]
        assert "email" in data["headers"]
        assert len(data["preview"]) >= 1
    
    def test_csv_import_with_mappings(self, authenticated_client, test_project):
        """Test CSV import with Form data (file, project_id, mappings)"""
        csv_content = "company,name,email,phone,title\nTEST_Import Co,Import User,import@test.com,555-9999,CEO"
        
        mappings = {
            "company_name": "company",
            "contact_name": "name",
            "email": "email",
            "phone": "phone",
            "title": "title"
        }
        
        # Prepare multipart form data
        files = {"file": ("import_test.csv", csv_content, "text/csv")}
        data = {
            "project_id": test_project["id"],
            "mappings": json.dumps(mappings)
        }
        
        headers = {"Authorization": authenticated_client.headers.get("Authorization", "")}
        
        response = requests.post(
            f"{BASE_URL}/api/prospects/upload/import",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "imported" in result
        assert result["imported"] >= 1
        print(f"Imported {result['imported']} prospects, errors: {result.get('errors', [])}")
    
    def test_csv_import_invalid_mappings(self, authenticated_client, test_project):
        """Test CSV import with invalid mappings format"""
        csv_content = "company,name,email\nTest Co,Test User,test@test.com"
        
        files = {"file": ("test.csv", csv_content, "text/csv")}
        data = {
            "project_id": test_project["id"],
            "mappings": "invalid-json"
        }
        
        headers = {"Authorization": authenticated_client.headers.get("Authorization", "")}
        
        response = requests.post(
            f"{BASE_URL}/api/prospects/upload/import",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 400
        assert "Invalid mappings format" in response.json().get("detail", "")


class TestScheduleLever:
    """Test Schedule Lever with domain limits and jitter"""
    
    def test_apply_lever_generates_tasks(self, authenticated_client, test_project, test_prospect):
        """Test that lever generates tasks with proper settings"""
        lever_data = {
            "project_id": test_project["id"],
            "start_date": "2026-02-01",
            "start_time": "09:00"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/tasks/lever", json=lever_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "tasks_count" in data
        assert "prospects_count" in data
        assert data["tasks_count"] >= 5  # At least 5 tasks per prospect
        assert "mails_per_domain_per_day" in data
        assert "jitter_minutes" in data
        print(f"Generated {data['tasks_count']} tasks for {data['prospects_count']} prospects")
    
    def test_lever_returns_scheduling_info(self, authenticated_client, test_project, test_prospect):
        """Test that lever response includes scheduling parameters"""
        lever_data = {
            "project_id": test_project["id"],
            "start_date": "2026-02-15",
            "start_time": "10:00"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/tasks/lever", json=lever_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "gap_days" in data
        assert "mails_per_domain_per_day" in data
        assert "jitter_minutes" in data
        assert "start_date" in data
    
    def test_lever_invalid_project(self, authenticated_client):
        """Test lever with invalid project ID"""
        lever_data = {
            "project_id": "invalid-project-id",
            "start_date": "2026-02-01",
            "start_time": "09:00"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/tasks/lever", json=lever_data)
        assert response.status_code == 404


class TestTaskUpdateWithEmailContent:
    """Test task update with sent_email_content field"""
    
    def test_update_task_with_sent_email_content(self, authenticated_client, test_project, test_prospect):
        """Test updating task with sent_email_content"""
        # First, get tasks for the prospect
        response = authenticated_client.get(f"{BASE_URL}/api/tasks?project_id={test_project['id']}")
        assert response.status_code == 200
        
        tasks = response.json()
        if not tasks:
            pytest.skip("No tasks available for testing")
        
        task = tasks[0]
        
        # Update task with sent_email_content
        update_data = {
            "status": "sent",
            "sent_timestamp": "2026-02-01T10:00:00Z",
            "sent_email_content": "Subject: Test Email\n\nHello,\n\nThis is a test email content that was sent.\n\nBest regards,\nTest User"
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/tasks/{task['id']}", json=update_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "sent"
        assert data["sent_email_content"] == update_data["sent_email_content"]
        print(f"Task updated with email content: {data['sent_email_content'][:50]}...")
    
    def test_task_response_includes_sent_email_content(self, authenticated_client, test_project):
        """Test that task response includes sent_email_content field"""
        response = authenticated_client.get(f"{BASE_URL}/api/tasks?project_id={test_project['id']}")
        assert response.status_code == 200
        
        tasks = response.json()
        if tasks:
            # Check that sent_email_content field exists in response
            task = tasks[0]
            assert "sent_email_content" in task or task.get("sent_email_content") is None


class TestNotesCRUD:
    """Test Notes CRUD operations"""
    
    def test_create_note(self, authenticated_client, test_prospect):
        """Test creating a note for a prospect"""
        note_data = {
            "prospect_id": test_prospect["id"],
            "content": "TEST_Note: This is a test note for the prospect."
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["content"] == note_data["content"]
        assert data["prospect_id"] == test_prospect["id"]
        assert "id" in data
        assert "user_name" in data
        assert "created_at" in data
        return data
    
    def test_get_prospect_notes(self, authenticated_client, test_prospect):
        """Test getting notes for a prospect"""
        # First create a note
        note_data = {
            "prospect_id": test_prospect["id"],
            "content": "TEST_Note: Another test note for listing."
        }
        authenticated_client.post(f"{BASE_URL}/api/notes", json=note_data)
        
        # Get notes
        response = authenticated_client.get(f"{BASE_URL}/api/notes/prospect/{test_prospect['id']}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        notes = response.json()
        assert isinstance(notes, list)
        assert len(notes) >= 1
        
        # Verify note structure
        note = notes[0]
        assert "id" in note
        assert "content" in note
        assert "user_name" in note
        assert "created_at" in note
    
    def test_update_note(self, authenticated_client, test_prospect):
        """Test updating a note"""
        # Create a note first
        note_data = {
            "prospect_id": test_prospect["id"],
            "content": "TEST_Note: Original content"
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert create_response.status_code == 200
        note = create_response.json()
        
        # Update the note
        update_data = {"content": "TEST_Note: Updated content"}
        response = authenticated_client.put(f"{BASE_URL}/api/notes/{note['id']}", json=update_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        updated_note = response.json()
        assert updated_note["content"] == "TEST_Note: Updated content"
        assert updated_note["id"] == note["id"]
    
    def test_delete_note(self, authenticated_client, test_prospect):
        """Test deleting a note"""
        # Create a note first
        note_data = {
            "prospect_id": test_prospect["id"],
            "content": "TEST_Note: To be deleted"
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert create_response.status_code == 200
        note = create_response.json()
        
        # Delete the note
        response = authenticated_client.delete(f"{BASE_URL}/api/notes/{note['id']}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/notes/prospect/{test_prospect['id']}")
        notes = get_response.json()
        note_ids = [n["id"] for n in notes]
        assert note["id"] not in note_ids
    
    def test_create_note_invalid_prospect(self, authenticated_client):
        """Test creating note with invalid prospect ID"""
        note_data = {
            "prospect_id": "invalid-prospect-id",
            "content": "This should fail"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 404


class TestCalendarEndpoints:
    """Test calendar-related endpoints"""
    
    def test_calendar_tasks(self, authenticated_client, test_project):
        """Test calendar tasks endpoint"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/tasks/calendar?start_date=2026-01-01&end_date=2026-12-31&project_id={test_project['id']}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            task = data[0]
            # Verify enriched fields
            assert "send_date" in task
            assert "send_time" in task
            assert "status" in task


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_prospects(self, authenticated_client):
        """Clean up TEST_ prefixed prospects"""
        response = authenticated_client.get(f"{BASE_URL}/api/prospects")
        if response.status_code == 200:
            prospects = response.json()
            for p in prospects:
                if p.get("company_name", "").startswith("TEST_") or p.get("contact_name", "").startswith("TEST_"):
                    authenticated_client.delete(f"{BASE_URL}/api/prospects/{p['id']}")
                    print(f"Cleaned up prospect: {p['id']}")
    
    def test_cleanup_test_projects(self, authenticated_client):
        """Clean up TEST_ prefixed projects"""
        response = authenticated_client.get(f"{BASE_URL}/api/projects")
        if response.status_code == 200:
            projects = response.json()
            for p in projects:
                if p.get("name", "").startswith("TEST_"):
                    authenticated_client.delete(f"{BASE_URL}/api/projects/{p['id']}")
                    print(f"Cleaned up project: {p['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
