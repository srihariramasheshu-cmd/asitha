"""
Tests for Simulation Mode API
- GET /api/simulation/status
- POST /api/simulation/start
- POST /api/simulation/end

Simulation creates: 1 project, 3 seats, 15 prospects, 60 tasks
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials for testing
SUPER_ADMIN_EMAIL = "srihariramasheshu@gmail.com"
SUPER_ADMIN_PASSWORD = "superadmin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestSimulationStatus:
    """Test GET /api/simulation/status"""
    
    def test_initial_status_returns_inactive(self, admin_headers):
        """Check simulation status when no simulation is running"""
        response = requests.get(f"{BASE_URL}/api/simulation/status", headers=admin_headers)
        assert response.status_code == 200, f"Status check failed: {response.text}"
        data = response.json()
        # Initial status should be active: false (unless a previous simulation exists)
        assert "active" in data, "Response should contain 'active' field"
        print(f"Initial simulation status: active={data.get('active')}")


class TestSimulationFullCycle:
    """Test full simulation cycle: start -> verify -> end -> verify cleanup"""
    
    def test_simulation_full_cycle(self, admin_headers):
        """Test complete simulation workflow"""
        
        # Step 1: Clean up any existing simulation first
        print("\n=== Step 1: Clean up any existing simulation ===")
        cleanup_response = requests.post(f"{BASE_URL}/api/simulation/end", headers=admin_headers)
        if cleanup_response.status_code == 200:
            print("Cleaned up existing simulation")
        elif cleanup_response.status_code == 404:
            print("No existing simulation to clean up")
        else:
            print(f"Cleanup response: {cleanup_response.status_code}")
        
        # Step 2: Verify simulation is inactive
        print("\n=== Step 2: Verify simulation is inactive ===")
        status_response = requests.get(f"{BASE_URL}/api/simulation/status", headers=admin_headers)
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data.get("active") == False, f"Expected inactive simulation, got: {status_data}"
        print(f"Simulation status: {status_data}")
        
        # Step 3: Start simulation
        print("\n=== Step 3: Start simulation ===")
        start_response = requests.post(f"{BASE_URL}/api/simulation/start", headers=admin_headers)
        assert start_response.status_code == 200, f"Start simulation failed: {start_response.text}"
        start_data = start_response.json()
        
        # Verify response structure
        assert "simulation_id" in start_data, "Response should contain simulation_id"
        assert "status" in start_data, "Response should contain status"
        assert "message" in start_data, "Response should contain message"
        assert "data" in start_data, "Response should contain data"
        
        simulation_id = start_data["simulation_id"]
        print(f"Simulation started with ID: {simulation_id}")
        print(f"Message: {start_data['message']}")
        
        # Verify simulation data
        sim_data = start_data["data"]
        assert sim_data.get("seats_count") == 3, f"Expected 3 seats, got {sim_data.get('seats_count')}"
        assert sim_data.get("prospects_count") == 15, f"Expected 15 prospects, got {sim_data.get('prospects_count')}"
        assert sim_data.get("tasks_created") == 60, f"Expected 60 tasks, got {sim_data.get('tasks_created')}"
        print(f"Created: {sim_data.get('seats_count')} seats, {sim_data.get('prospects_count')} prospects, {sim_data.get('tasks_created')} tasks")
        
        # Verify project name
        assert "[SIM]" in sim_data.get("project_name", ""), "Project name should contain [SIM]"
        print(f"Project: {sim_data.get('project_name')}")
        
        # Verify seats data
        seats = sim_data.get("seats", [])
        assert len(seats) == 3, f"Expected 3 seats in data, got {len(seats)}"
        for seat in seats:
            assert "name" in seat, "Seat should have name"
            assert "email" in seat, "Seat should have email"
            assert "mail_id" in seat, "Seat should have assigned mail_id"
            print(f"  Seat: {seat['name']} ({seat['email']}) -> {seat['mail_id']}")
        
        # Step 4: Verify simulation is active
        print("\n=== Step 4: Verify simulation is active ===")
        status_response = requests.get(f"{BASE_URL}/api/simulation/status", headers=admin_headers)
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data.get("active") == True, f"Expected active simulation, got: {status_data}"
        assert status_data.get("simulation_id") == simulation_id, "Simulation ID should match"
        print(f"Simulation is active: {status_data}")
        
        # Step 5: Try to start another simulation (should fail)
        print("\n=== Step 5: Verify cannot start another simulation ===")
        duplicate_response = requests.post(f"{BASE_URL}/api/simulation/start", headers=admin_headers)
        assert duplicate_response.status_code == 400, f"Should not allow starting another simulation: {duplicate_response.text}"
        print(f"Correctly blocked duplicate simulation: {duplicate_response.json().get('detail')}")
        
        # Step 6: End simulation
        print("\n=== Step 6: End simulation ===")
        end_response = requests.post(f"{BASE_URL}/api/simulation/end", headers=admin_headers)
        assert end_response.status_code == 200, f"End simulation failed: {end_response.text}"
        end_data = end_response.json()
        
        assert "simulation_id" in end_data, "Response should contain simulation_id"
        assert "deleted" in end_data, "Response should contain deleted counts"
        print(f"Simulation ended: {end_data['message']}")
        
        # Verify deleted counts
        deleted = end_data.get("deleted", {})
        assert deleted.get("tasks") == 60, f"Expected 60 tasks deleted, got {deleted.get('tasks')}"
        assert deleted.get("prospects") == 15, f"Expected 15 prospects deleted, got {deleted.get('prospects')}"
        assert deleted.get("users") == 3, f"Expected 3 users deleted, got {deleted.get('users')}"
        assert deleted.get("projects") == 1, f"Expected 1 project deleted, got {deleted.get('projects')}"
        print(f"Deleted: {deleted}")
        
        # Step 7: Verify simulation is inactive after end
        print("\n=== Step 7: Verify simulation is inactive after end ===")
        final_status_response = requests.get(f"{BASE_URL}/api/simulation/status", headers=admin_headers)
        assert final_status_response.status_code == 200
        final_status_data = final_status_response.json()
        assert final_status_data.get("active") == False, f"Expected inactive simulation after end, got: {final_status_data}"
        print(f"Simulation is inactive: {final_status_data}")
        
        # Step 8: Verify ending inactive simulation fails
        print("\n=== Step 8: Verify cannot end inactive simulation ===")
        end_again_response = requests.post(f"{BASE_URL}/api/simulation/end", headers=admin_headers)
        assert end_again_response.status_code == 404, f"Should fail to end inactive simulation: {end_again_response.text}"
        print(f"Correctly blocked ending inactive simulation: {end_again_response.json().get('detail')}")
        
        print("\n=== ALL TESTS PASSED ===")


class TestSimulationDataVerification:
    """Test that simulation creates proper data structure"""
    
    def test_simulation_creates_valid_data(self, admin_headers):
        """Verify all simulation data is properly created and linked"""
        
        # Clean up first
        requests.post(f"{BASE_URL}/api/simulation/end", headers=admin_headers)
        
        # Start simulation
        start_response = requests.post(f"{BASE_URL}/api/simulation/start", headers=admin_headers)
        assert start_response.status_code == 200
        sim_data = start_response.json()["data"]
        project_id = sim_data.get("project_id")
        
        print(f"\n=== Verifying simulation data for project {project_id} ===")
        
        # Verify project exists and has correct config
        project_response = requests.get(f"{BASE_URL}/api/projects/{project_id}", headers=admin_headers)
        assert project_response.status_code == 200
        project = project_response.json()
        assert "[SIM]" in project.get("name", "")
        assert project.get("touchpoints_count") == 4
        print(f"Project verified: {project['name']}")
        
        # Verify mail domains
        domains_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/mail-domains", headers=admin_headers)
        assert domains_response.status_code == 200
        domains = domains_response.json()
        assert len(domains) == 1
        assert domains[0]["domain"] == "simcompany.test"
        print(f"Mail domain verified: {domains[0]['domain']}")
        
        # Verify mail IDs
        mail_ids_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/mail-ids", headers=admin_headers)
        assert mail_ids_response.status_code == 200
        mail_ids = mail_ids_response.json()
        assert len(mail_ids) == 3
        print(f"Mail IDs verified: {len(mail_ids)} mail IDs")
        
        # Verify tasks with date range
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        future = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        tasks_response = requests.get(
            f"{BASE_URL}/api/tasks/calendar",
            params={"start_date": today, "end_date": future, "project_id": project_id},
            headers=admin_headers
        )
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()
        assert len(tasks) == 60, f"Expected 60 tasks, got {len(tasks)}"
        print(f"Tasks verified: {len(tasks)} tasks created")
        
        # Check task step distribution
        step_counts = {}
        for task in tasks:
            step = task.get("step_number", 0)
            step_counts[step] = step_counts.get(step, 0) + 1
        print(f"Task distribution by step: {step_counts}")
        # 15 prospects * 4 touchpoints = 60 tasks (15 per step)
        assert step_counts.get(1, 0) == 15, f"Expected 15 intro emails, got {step_counts.get(1, 0)}"
        
        # Clean up
        end_response = requests.post(f"{BASE_URL}/api/simulation/end", headers=admin_headers)
        assert end_response.status_code == 200
        print("\n=== Data verification complete, simulation ended ===")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
