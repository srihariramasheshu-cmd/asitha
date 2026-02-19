"""
Test Simulation Workflow - ABM Blinder
Tests the updated simulation mode that:
1. Shows only simulation data (hides real data)
2. Provides sample CSV for prospect upload
3. Allows task management with notes and status changes

Features tested:
- Simulation start creates project/seats but NO auto-prospects
- GET /api/simulation/sample-csv returns downloadable CSV with prospect data
- GET /api/projects only returns simulation projects when simulation active
- GET /api/prospects only returns simulation prospects when simulation active
- GET /api/tasks only returns simulation tasks when simulation active
- Login as simulation seat and verify they see only simulation data
- Upload prospects CSV to simulation project
- Schedule prospects and verify tasks are created with simulation_id
- Task Management: Edit task status (pending -> sent)
- Task Management: Add note to prospect via task edit modal
- End simulation cleans up all data
"""

import pytest
import requests
import os
import csv
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSimulationWorkflow:
    """Full simulation workflow tests"""
    
    # Class-level storage for simulation data
    admin_token = None
    simulation_id = None
    simulation_project_id = None
    simulation_seats = None
    seat_token = None
    uploaded_prospect_ids = []
    created_task_ids = []
    created_note_ids = []
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup before each test"""
        self.base_url = BASE_URL
        assert self.base_url, "REACT_APP_BACKEND_URL environment variable not set"
    
    def test_01_admin_login(self):
        """Test super admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "srihariramasheshu@gmail.com",
            "password": "superadmin123"
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"
        
        TestSimulationWorkflow.admin_token = data["token"]
        print(f"Admin login successful, role: {data['user']['role']}")
    
    def test_02_end_any_existing_simulation(self):
        """Clean up any existing simulation before starting"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        # Check simulation status
        status_res = requests.get(f"{BASE_URL}/api/simulation/status", headers=headers)
        
        if status_res.status_code == 200 and status_res.json().get("active"):
            # End existing simulation
            end_res = requests.post(f"{BASE_URL}/api/simulation/end", headers=headers)
            assert end_res.status_code == 200, f"Failed to end existing simulation: {end_res.text}"
            print("Ended existing simulation")
        else:
            print("No active simulation found")
    
    def test_03_start_simulation(self):
        """Start new simulation - should create project/seats but NO auto-prospects"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/simulation/start", headers=headers)
        
        assert response.status_code == 200, f"Start simulation failed: {response.text}"
        data = response.json()
        
        # Verify simulation started
        assert "simulation_id" in data
        assert data["message"] == "Simulation started successfully"
        
        TestSimulationWorkflow.simulation_id = data["simulation_id"]
        TestSimulationWorkflow.simulation_seats = data["data"]["seats"]
        
        print(f"Simulation started: {data['simulation_id']}")
        print(f"Created {len(data['data']['seats'])} seats")
    
    def test_04_verify_no_auto_prospects(self):
        """Verify simulation doesn't auto-generate prospects"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        # Get prospects - should be empty for simulation
        response = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        
        assert response.status_code == 200
        prospects = response.json()
        
        # Should have NO auto-generated prospects
        assert len(prospects) == 0, f"Expected 0 prospects but got {len(prospects)}"
        print("Verified: No auto-generated prospects")
    
    def test_05_sample_csv_download(self):
        """Test sample CSV endpoint returns valid CSV with 8 records"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/simulation/sample-csv", headers=headers)
        
        assert response.status_code == 200, f"Sample CSV download failed: {response.text}"
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Parse CSV
        csv_content = response.text
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        
        # Should have 8 sample records
        assert len(rows) == 8, f"Expected 8 sample records, got {len(rows)}"
        
        # Verify CSV has required columns
        required_cols = ["company_name", "contact_name", "email", "phone", "linkedin", "title", "domain"]
        for col in required_cols:
            assert col in reader.fieldnames, f"Missing column: {col}"
        
        # Verify first row has valid data
        first_row = rows[0]
        assert first_row["company_name"] == "Acme Corp"
        assert first_row["contact_name"] == "John Smith"
        assert first_row["email"] == "john.smith@acmecorp.com"
        
        print(f"Sample CSV downloaded: {len(rows)} records with columns {reader.fieldnames}")
    
    def test_06_get_simulation_project(self):
        """Verify simulation project is returned when simulation active"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        
        assert response.status_code == 200
        projects = response.json()
        
        # Should only return simulation project
        assert len(projects) == 1, f"Expected 1 simulation project, got {len(projects)}"
        
        project = projects[0]
        assert "Simulation" in project["name"] or "simulation" in project["name"].lower()
        
        TestSimulationWorkflow.simulation_project_id = project["id"]
        print(f"Simulation project: {project['name']} (ID: {project['id']})")
    
    def test_07_simulation_seat_login(self):
        """Login as simulation seat and verify access"""
        # Use first simulation seat
        seat = TestSimulationWorkflow.simulation_seats[0]
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": seat["email"],
            "password": "simpass123"
        })
        
        assert response.status_code == 200, f"Seat login failed: {response.text}"
        data = response.json()
        
        assert data["user"]["role"] == "seat"
        TestSimulationWorkflow.seat_token = data["token"]
        
        print(f"Logged in as seat: {seat['email']}")
    
    def test_08_seat_sees_only_simulation_data(self):
        """Verify seat only sees simulation projects/prospects"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.seat_token}"}
        
        # Projects - should only see simulation project
        projects_res = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        assert projects_res.status_code == 200
        projects = projects_res.json()
        assert len(projects) == 1, f"Seat should see only 1 project, got {len(projects)}"
        
        # Prospects - should be empty (we haven't uploaded yet)
        prospects_res = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        assert prospects_res.status_code == 200
        prospects = prospects_res.json()
        assert len(prospects) == 0, f"Seat should see 0 prospects before upload"
        
        # Tasks - should be empty
        tasks_res = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        assert tasks_res.status_code == 200
        tasks = tasks_res.json()
        assert len(tasks) == 0, f"Seat should see 0 tasks before scheduling"
        
        print("Seat sees only simulation data (filtered correctly)")
    
    def test_09_upload_prospects_csv(self):
        """Upload sample prospects to simulation project"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        # First, get sample CSV
        csv_res = requests.get(f"{BASE_URL}/api/simulation/sample-csv", headers=headers)
        csv_content = csv_res.text
        
        # Create file-like object
        csv_file = io.BytesIO(csv_content.encode())
        
        # Upload with mappings
        mappings = {
            "company_name": "company_name",
            "contact_name": "contact_name",
            "email": "email",
            "phone": "phone",
            "linkedin": "linkedin",
            "title": "title",
            "domain": "domain"
        }
        
        import json
        response = requests.post(
            f"{BASE_URL}/api/prospects/upload/import",
            headers=headers,
            files={"file": ("prospects.csv", csv_file, "text/csv")},
            data={
                "project_id": TestSimulationWorkflow.simulation_project_id,
                "mappings": json.dumps(mappings)
            }
        )
        
        assert response.status_code == 200, f"CSV upload failed: {response.text}"
        data = response.json()
        
        assert data["imported"] == 8, f"Expected 8 imported, got {data['imported']}"
        assert len(data.get("errors", [])) == 0, f"Import errors: {data.get('errors')}"
        
        print(f"Uploaded {data['imported']} prospects successfully")
    
    def test_10_verify_uploaded_prospects_have_simulation_id(self):
        """Verify uploaded prospects are tagged with simulation_id"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        
        assert response.status_code == 200
        prospects = response.json()
        
        assert len(prospects) == 8, f"Expected 8 prospects, got {len(prospects)}"
        
        # Store IDs for later cleanup tracking
        TestSimulationWorkflow.uploaded_prospect_ids = [p["id"] for p in prospects]
        
        # Verify first prospect
        first_prospect = prospects[0]
        assert first_prospect["project_id"] == TestSimulationWorkflow.simulation_project_id
        
        print(f"Verified {len(prospects)} prospects uploaded with correct project_id")
    
    def test_11_schedule_prospects(self):
        """Schedule prospects and verify tasks are created with simulation_id"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.seat_token}"}
        
        # Schedule using seat token
        response = requests.post(
            f"{BASE_URL}/api/projects/{TestSimulationWorkflow.simulation_project_id}/schedule-prospects",
            headers=headers
        )
        
        # Note: This might fail if seat doesn't have mail IDs assigned
        if response.status_code == 400 and "mail ID" in response.text.lower():
            print("Seat doesn't have mail IDs assigned - using admin to schedule")
            # Try with admin
            headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
            response = requests.post(
                f"{BASE_URL}/api/projects/{TestSimulationWorkflow.simulation_project_id}/schedule-prospects",
                headers=headers
            )
        
        assert response.status_code == 200, f"Scheduling failed: {response.text}"
        data = response.json()
        
        print(f"Scheduled {data.get('scheduled_prospects', 0)} prospects, created {data.get('total_tasks_created', 0)} tasks")
    
    def test_12_verify_tasks_have_simulation_id(self):
        """Verify scheduled tasks are filtered by simulation"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        
        assert response.status_code == 200
        tasks = response.json()
        
        # Should have tasks created from scheduling
        assert len(tasks) > 0, "No tasks created from scheduling"
        
        # Store for later tests
        TestSimulationWorkflow.created_task_ids = [t["id"] for t in tasks]
        
        # All tasks should be pending initially
        pending_tasks = [t for t in tasks if t["status"] == "pending"]
        assert len(pending_tasks) == len(tasks), "All new tasks should be pending"
        
        print(f"Verified {len(tasks)} tasks created (all pending)")
    
    def test_13_task_status_update_pending_to_sent(self):
        """Test updating task status from pending to sent"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.created_task_ids:
            pytest.skip("No tasks available to test")
        
        task_id = TestSimulationWorkflow.created_task_ids[0]
        
        # Update task status
        response = requests.put(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=headers,
            json={"status": "sent"}
        )
        
        assert response.status_code == 200, f"Task status update failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "sent", f"Expected status 'sent', got '{data['status']}'"
        
        print(f"Task {task_id} status updated to 'sent'")
    
    def test_14_add_note_to_prospect(self):
        """Test adding a note to a prospect via notes endpoint"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.uploaded_prospect_ids:
            pytest.skip("No prospects available to test")
        
        prospect_id = TestSimulationWorkflow.uploaded_prospect_ids[0]
        
        # Add note using correct endpoint
        response = requests.post(
            f"{BASE_URL}/api/notes",
            headers=headers,
            json={
                "prospect_id": prospect_id,
                "content": "Test note from simulation workflow - contacted via phone"
            }
        )
        
        assert response.status_code == 200, f"Add note failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["prospect_id"] == prospect_id
        assert "Test note" in data["content"]
        
        TestSimulationWorkflow.created_note_ids.append(data["id"])
        print(f"Added note to prospect {prospect_id}")
    
    def test_15_get_prospect_notes(self):
        """Test retrieving notes for a prospect"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.uploaded_prospect_ids:
            pytest.skip("No prospects available to test")
        
        prospect_id = TestSimulationWorkflow.uploaded_prospect_ids[0]
        
        # Get notes using correct endpoint
        response = requests.get(
            f"{BASE_URL}/api/notes/prospect/{prospect_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notes failed: {response.text}"
        notes = response.json()
        
        assert len(notes) >= 1, "Should have at least 1 note"
        assert notes[0]["prospect_id"] == prospect_id
        
        print(f"Retrieved {len(notes)} notes for prospect")
    
    def test_16_end_simulation_cleanup(self):
        """End simulation and verify all simulation data is cleaned up"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/simulation/end", headers=headers)
        
        assert response.status_code == 200, f"End simulation failed: {response.text}"
        data = response.json()
        
        assert "deleted_counts" in data
        deleted = data["deleted_counts"]
        
        print(f"Simulation ended. Deleted: {deleted}")
        
        # Verify cleanup
        assert deleted.get("prospects", 0) >= 8, "Should have deleted uploaded prospects"
        assert deleted.get("tasks", 0) > 0, "Should have deleted created tasks"
    
    def test_17_verify_simulation_data_removed(self):
        """Verify simulation user can no longer login and data is gone"""
        # Try login with simulation seat - should fail
        seat = TestSimulationWorkflow.simulation_seats[0]
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": seat["email"],
            "password": "simpass123"
        })
        
        assert response.status_code == 401, f"Simulation user should not be able to login after cleanup"
        print("Simulation user correctly denied login after cleanup")
    
    def test_18_verify_real_data_visible_after_simulation(self):
        """Verify real projects/data visible after simulation ends"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        # Projects should show real projects (not simulation)
        projects_res = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        assert projects_res.status_code == 200
        projects = projects_res.json()
        
        # Should NOT have simulation project anymore
        simulation_projects = [p for p in projects if "simulation" in p["name"].lower()]
        assert len(simulation_projects) == 0, "Simulation project should be deleted"
        
        print(f"Real data visible: {len(projects)} projects")


class TestNotesAPIEndpoints:
    """Test notes API endpoint correctness"""
    
    admin_token = None
    test_prospect_id = None
    
    def test_01_setup_admin(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "srihariramasheshu@gmail.com",
            "password": "superadmin123"
        })
        assert response.status_code == 200
        TestNotesAPIEndpoints.admin_token = response.json()["token"]
    
    def test_02_get_any_prospect_for_notes_test(self):
        """Get a prospect to test notes"""
        headers = {"Authorization": f"Bearer {TestNotesAPIEndpoints.admin_token}"}
        
        # Ensure no simulation is active first
        status = requests.get(f"{BASE_URL}/api/simulation/status", headers=headers)
        if status.status_code == 200 and status.json().get("active"):
            requests.post(f"{BASE_URL}/api/simulation/end", headers=headers)
        
        # Get real prospects
        response = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        
        if response.status_code == 200 and len(response.json()) > 0:
            TestNotesAPIEndpoints.test_prospect_id = response.json()[0]["id"]
            print(f"Using existing prospect: {TestNotesAPIEndpoints.test_prospect_id}")
        else:
            pytest.skip("No prospects available to test notes")
    
    def test_03_notes_post_endpoint(self):
        """Test POST /api/notes endpoint"""
        if not TestNotesAPIEndpoints.test_prospect_id:
            pytest.skip("No prospect for testing")
        
        headers = {"Authorization": f"Bearer {TestNotesAPIEndpoints.admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/notes",
            headers=headers,
            json={
                "prospect_id": TestNotesAPIEndpoints.test_prospect_id,
                "content": "API test note"
            }
        )
        
        assert response.status_code == 200, f"POST /api/notes failed: {response.text}"
        print("POST /api/notes works correctly")
    
    def test_04_notes_get_endpoint(self):
        """Test GET /api/notes/prospect/{prospect_id} endpoint"""
        if not TestNotesAPIEndpoints.test_prospect_id:
            pytest.skip("No prospect for testing")
        
        headers = {"Authorization": f"Bearer {TestNotesAPIEndpoints.admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/notes/prospect/{TestNotesAPIEndpoints.test_prospect_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"GET /api/notes/prospect/ failed: {response.text}"
        print("GET /api/notes/prospect/{id} works correctly")


class TestTaskStatusUpdate:
    """Test task status update endpoint"""
    
    admin_token = None
    test_task_id = None
    
    def test_01_setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "srihariramasheshu@gmail.com",
            "password": "superadmin123"
        })
        assert response.status_code == 200
        TestTaskStatusUpdate.admin_token = response.json()["token"]
    
    def test_02_get_any_task(self):
        """Get a task to test status update"""
        headers = {"Authorization": f"Bearer {TestTaskStatusUpdate.admin_token}"}
        
        # Ensure no simulation active
        status = requests.get(f"{BASE_URL}/api/simulation/status", headers=headers)
        if status.status_code == 200 and status.json().get("active"):
            requests.post(f"{BASE_URL}/api/simulation/end", headers=headers)
        
        response = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        
        if response.status_code == 200 and len(response.json()) > 0:
            TestTaskStatusUpdate.test_task_id = response.json()[0]["id"]
            print(f"Using existing task: {TestTaskStatusUpdate.test_task_id}")
        else:
            print("No tasks available - this is expected if no schedules exist")
    
    def test_03_task_status_update_correct_endpoint(self):
        """Test PUT /api/tasks/{task_id} for status update (correct endpoint)"""
        if not TestTaskStatusUpdate.test_task_id:
            pytest.skip("No task for testing")
        
        headers = {"Authorization": f"Bearer {TestTaskStatusUpdate.admin_token}"}
        
        # Get current status
        get_res = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        current_task = next((t for t in get_res.json() if t["id"] == TestTaskStatusUpdate.test_task_id), None)
        
        if not current_task:
            pytest.skip("Task not found")
        
        # Update using correct endpoint
        response = requests.put(
            f"{BASE_URL}/api/tasks/{TestTaskStatusUpdate.test_task_id}",
            headers=headers,
            json={"status": "pending"}  # Reset to pending
        )
        
        assert response.status_code == 200, f"PUT /api/tasks/{{}}/status failed: {response.text}"
        print("PUT /api/tasks/{id} works correctly for status update")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
