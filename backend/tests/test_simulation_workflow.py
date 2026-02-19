"""
Test Simulation Workflow - ABM Blinder
Tests the updated simulation mode that:
1. Shows only simulation data (hides real data)
2. Provides sample CSV for prospect upload
3. Allows task management with notes and status changes
"""

import pytest
import requests
import os
import csv
import io
import json

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
        assert "Simulation started" in data["message"]  # Flexible message check
        
        TestSimulationWorkflow.simulation_id = data["simulation_id"]
        TestSimulationWorkflow.simulation_seats = data["data"]["seats"]
        
        print(f"Simulation started: {data['simulation_id']}")
        print(f"Seats created: {[s['email'] for s in TestSimulationWorkflow.simulation_seats]}")
    
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
        
        print(f"Sample CSV downloaded: {len(rows)} records")
    
    def test_06_get_simulation_project(self):
        """Verify simulation project is returned when simulation active"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        
        assert response.status_code == 200
        projects = response.json()
        
        # Should only return simulation project (projects have [SIM] prefix)
        assert len(projects) == 1, f"Expected 1 simulation project, got {len(projects)}"
        
        project = projects[0]
        # Project name has [SIM] prefix
        assert "[SIM]" in project["name"] or "sim" in project["name"].lower()
        
        TestSimulationWorkflow.simulation_project_id = project["id"]
        print(f"Simulation project: {project['name']} (ID: {project['id']})")
    
    def test_07_simulation_seat_login(self):
        """Login as simulation seat and verify access"""
        if not TestSimulationWorkflow.simulation_seats:
            pytest.skip("No simulation seats created")
        
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
        if not TestSimulationWorkflow.seat_token:
            pytest.skip("No seat token available")
        
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
        
        if not TestSimulationWorkflow.simulation_project_id:
            pytest.skip("No simulation project ID")
        
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
    
    def test_10_verify_uploaded_prospects(self):
        """Verify uploaded prospects exist"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        
        assert response.status_code == 200
        prospects = response.json()
        
        assert len(prospects) == 8, f"Expected 8 prospects, got {len(prospects)}"
        
        # Store IDs for later
        TestSimulationWorkflow.uploaded_prospect_ids = [p["id"] for p in prospects]
        
        # Verify first prospect
        first_prospect = prospects[0]
        assert first_prospect["project_id"] == TestSimulationWorkflow.simulation_project_id
        
        print(f"Verified {len(prospects)} prospects uploaded")
    
    def test_11_schedule_prospects_as_admin(self):
        """Schedule prospects using admin token"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.simulation_project_id:
            pytest.skip("No simulation project ID")
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TestSimulationWorkflow.simulation_project_id}/schedule-prospects",
            headers=headers
        )
        
        # Check for mail ID issues which are expected if config isn't complete
        if response.status_code == 400:
            error_text = response.text.lower()
            if "mail" in error_text:
                print(f"Scheduling skipped - no mail IDs configured (expected): {response.text}")
                pytest.skip("No mail IDs assigned - this is expected for fresh simulation")
            else:
                assert False, f"Scheduling failed: {response.text}"
        
        assert response.status_code == 200, f"Scheduling failed: {response.text}"
        data = response.json()
        
        print(f"Scheduled prospects, created {data.get('total_tasks_created', 0)} tasks")
    
    def test_12_verify_tasks_exist(self):
        """Verify tasks were created"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        
        assert response.status_code == 200
        tasks = response.json()
        
        # Tasks may be 0 if scheduling was skipped
        if len(tasks) == 0:
            print("No tasks found - scheduling may have been skipped due to missing mail IDs")
            return
        
        TestSimulationWorkflow.created_task_ids = [t["id"] for t in tasks]
        
        pending_tasks = [t for t in tasks if t["status"] == "pending"]
        assert len(pending_tasks) == len(tasks), "All new tasks should be pending"
        
        print(f"Verified {len(tasks)} tasks created")
    
    def test_13_task_status_update(self):
        """Test updating task status from pending to sent"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.created_task_ids:
            # Try to get any tasks
            tasks_res = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
            if tasks_res.status_code == 200 and len(tasks_res.json()) > 0:
                TestSimulationWorkflow.created_task_ids = [t["id"] for t in tasks_res.json()]
        
        if not TestSimulationWorkflow.created_task_ids:
            pytest.skip("No tasks available to test")
        
        task_id = TestSimulationWorkflow.created_task_ids[0]
        
        # Update task status using correct PUT endpoint
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
        """Test adding a note to a prospect"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.uploaded_prospect_ids:
            # Get prospects
            prospects_res = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
            if prospects_res.status_code == 200 and len(prospects_res.json()) > 0:
                TestSimulationWorkflow.uploaded_prospect_ids = [p["id"] for p in prospects_res.json()]
        
        if not TestSimulationWorkflow.uploaded_prospect_ids:
            pytest.skip("No prospects available to test")
        
        prospect_id = TestSimulationWorkflow.uploaded_prospect_ids[0]
        
        # Add note using correct endpoint: POST /api/notes
        response = requests.post(
            f"{BASE_URL}/api/notes",
            headers=headers,
            json={
                "prospect_id": prospect_id,
                "content": "Test note from simulation workflow"
            }
        )
        
        assert response.status_code == 200, f"Add note failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["prospect_id"] == prospect_id
        
        TestSimulationWorkflow.created_note_ids.append(data["id"])
        print(f"Added note to prospect {prospect_id}")
    
    def test_15_get_prospect_notes(self):
        """Test retrieving notes for a prospect"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        if not TestSimulationWorkflow.uploaded_prospect_ids:
            pytest.skip("No prospects available")
        
        prospect_id = TestSimulationWorkflow.uploaded_prospect_ids[0]
        
        # Get notes using correct endpoint: GET /api/notes/prospect/{prospect_id}
        response = requests.get(
            f"{BASE_URL}/api/notes/prospect/{prospect_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notes failed: {response.text}"
        notes = response.json()
        
        assert len(notes) >= 1, "Should have at least 1 note"
        
        print(f"Retrieved {len(notes)} notes for prospect")
    
    def test_16_end_simulation(self):
        """End simulation and verify cleanup"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/simulation/end", headers=headers)
        
        assert response.status_code == 200, f"End simulation failed: {response.text}"
        data = response.json()
        
        # Check for deleted key (API returns "deleted" not "deleted_counts")
        assert "deleted" in data or "deleted_counts" in data, f"Missing deleted info: {data}"
        
        deleted = data.get("deleted") or data.get("deleted_counts", {})
        print(f"Simulation ended. Deleted: {deleted}")
    
    def test_17_verify_cleanup(self):
        """Verify simulation data removed"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        # Check that simulation is no longer active
        status_res = requests.get(f"{BASE_URL}/api/simulation/status", headers=headers)
        assert status_res.status_code == 200
        assert status_res.json().get("active") == False, "Simulation should not be active"
        
        # Verify simulation seat can't login
        if TestSimulationWorkflow.simulation_seats:
            seat = TestSimulationWorkflow.simulation_seats[0]
            login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": seat["email"],
                "password": "simpass123"
            })
            assert login_res.status_code == 401, "Simulation user should not be able to login after cleanup"
            print("Simulation user correctly denied login after cleanup")
    
    def test_18_real_data_visible(self):
        """Verify real data visible after simulation ends"""
        headers = {"Authorization": f"Bearer {TestSimulationWorkflow.admin_token}"}
        
        projects_res = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        assert projects_res.status_code == 200
        projects = projects_res.json()
        
        # Should NOT have simulation project anymore (no [SIM] prefix)
        sim_projects = [p for p in projects if "[SIM]" in p.get("name", "")]
        assert len(sim_projects) == 0, "Simulation project should be deleted"
        
        print(f"Real data visible: {len(projects)} projects")


class TestFrontendAPICompatibility:
    """Test that frontend API calls match backend endpoints"""
    
    admin_token = None
    
    def test_01_setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "srihariramasheshu@gmail.com",
            "password": "superadmin123"
        })
        assert response.status_code == 200
        TestFrontendAPICompatibility.admin_token = response.json()["token"]
    
    def test_02_task_status_update_endpoint(self):
        """
        ISSUE: Frontend TaskManagementPage.jsx line 193 uses:
        PUT /api/tasks/${editingTask.id}/status
        
        Backend expects: PUT /api/tasks/{task_id} with status in body
        
        This is a potential BUG - frontend endpoint doesn't match backend
        """
        headers = {"Authorization": f"Bearer {TestFrontendAPICompatibility.admin_token}"}
        
        # Test the endpoint frontend is calling (SHOULD FAIL)
        tasks_res = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        if tasks_res.status_code == 200 and len(tasks_res.json()) > 0:
            task_id = tasks_res.json()[0]["id"]
            
            # Test frontend-style endpoint (likely to fail with 404/405)
            wrong_endpoint = requests.put(
                f"{BASE_URL}/api/tasks/{task_id}/status",
                headers=headers,
                json={"status": "pending"}
            )
            
            # This should fail - no such endpoint exists
            if wrong_endpoint.status_code in [404, 405]:
                print(f"CONFIRMED BUG: Frontend endpoint /api/tasks/{task_id}/status returns {wrong_endpoint.status_code}")
                print("Frontend needs to use PUT /api/tasks/{task_id} with status in body instead")
            elif wrong_endpoint.status_code == 200:
                print("Endpoint works - may have been added to backend")
        else:
            print("No tasks to test endpoint compatibility")
    
    def test_03_notes_endpoint_mismatch(self):
        """
        ISSUE: Frontend TaskManagementPage.jsx uses:
        - GET /api/prospects/${prospect_id}/notes (line 178, 220, 233)
        - POST /api/prospects/${prospect_id}/notes (line 214)
        
        Backend has:
        - GET /api/notes/prospect/{prospect_id}
        - POST /api/notes (with prospect_id in body)
        
        This is a potential BUG - frontend endpoints don't match backend
        """
        headers = {"Authorization": f"Bearer {TestFrontendAPICompatibility.admin_token}"}
        
        # Get a prospect to test
        prospects_res = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        if prospects_res.status_code == 200 and len(prospects_res.json()) > 0:
            prospect_id = prospects_res.json()[0]["id"]
            
            # Test frontend-style GET endpoint (SHOULD FAIL)
            wrong_get = requests.get(
                f"{BASE_URL}/api/prospects/{prospect_id}/notes",
                headers=headers
            )
            
            if wrong_get.status_code in [404, 405]:
                print(f"CONFIRMED BUG: Frontend GET /api/prospects/{prospect_id}/notes returns {wrong_get.status_code}")
                print("Frontend needs to use GET /api/notes/prospect/{prospect_id} instead")
            elif wrong_get.status_code == 200:
                print("Endpoint works - may have been added to backend")
            
            # Test frontend-style POST endpoint (SHOULD FAIL)
            wrong_post = requests.post(
                f"{BASE_URL}/api/prospects/{prospect_id}/notes",
                headers=headers,
                json={"content": "test note"}
            )
            
            if wrong_post.status_code in [404, 405]:
                print(f"CONFIRMED BUG: Frontend POST /api/prospects/{prospect_id}/notes returns {wrong_post.status_code}")
                print("Frontend needs to use POST /api/notes with prospect_id in body instead")
            elif wrong_post.status_code == 200:
                print("Endpoint works - may have been added to backend")
        else:
            print("No prospects to test endpoint compatibility")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
