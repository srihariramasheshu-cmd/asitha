import requests
import sys
import json
from datetime import datetime

class ABMBlinder_APITester:
    def __init__(self, base_url="https://abmblinder.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_user = None
        self.created_project_id = None
        self.created_seat_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        # Remove Content-Type for file uploads
        if files:
            headers.pop('Content-Type', None)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Root endpoint", "GET", "", 200)
        self.run_test("Health check", "GET", "health", 200)

    def test_authentication(self):
        """Test authentication flow"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test login with admin credentials
        success, response = self.run_test(
            "Admin login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@abmblinder.com", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.admin_user = response['user']
            print(f"   Token obtained: {self.token[:20]}...")
            print(f"   User: {self.admin_user['name']} ({self.admin_user['role']})")
            
            # Test /auth/me endpoint
            self.run_test("Get current user", "GET", "auth/me", 200)
            return True
        else:
            print("❌ Failed to get authentication token")
            return False

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT")
        print("="*50)
        
        # List all users
        self.run_test("List all users", "GET", "users", 200)
        
        # List seats only
        self.run_test("List seats", "GET", "users/seats", 200)
        
        # Create a new seat
        seat_data = {
            "name": f"Test Seat {datetime.now().strftime('%H%M%S')}",
            "email": f"testseat{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "testpass123",
            "role": "seat"
        }
        
        success, response = self.run_test(
            "Create new seat",
            "POST",
            "users",
            200,
            data=seat_data
        )
        
        if success and 'id' in response:
            self.created_seat_id = response['id']
            print(f"   Created seat ID: {self.created_seat_id}")

    def test_project_management(self):
        """Test project management endpoints"""
        print("\n" + "="*50)
        print("TESTING PROJECT MANAGEMENT")
        print("="*50)
        
        # List projects
        self.run_test("List projects", "GET", "projects", 200)
        
        # Create a new project
        project_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "Test project for API testing",
            "domains": ["test1.com", "test2.com"]
        }
        
        success, response = self.run_test(
            "Create new project",
            "POST",
            "projects",
            200,
            data=project_data
        )
        
        if success and 'id' in response:
            self.created_project_id = response['id']
            print(f"   Created project ID: {self.created_project_id}")
            
            # Get specific project
            self.run_test(
                "Get project by ID",
                "GET",
                f"projects/{self.created_project_id}",
                200
            )
            
            # Assign seat to project (if we have both)
            if self.created_seat_id:
                success, _ = self.run_test(
                    "Assign seat to project",
                    "POST",
                    f"projects/{self.created_project_id}/assign?seat_id={self.created_seat_id}",
                    200
                )
                
                if success:
                    # Get project seats
                    self.run_test(
                        "Get project seats",
                        "GET",
                        f"projects/{self.created_project_id}/seats",
                        200
                    )

    def test_prospects_management(self):
        """Test prospects management endpoints"""
        print("\n" + "="*50)
        print("TESTING PROSPECTS MANAGEMENT")
        print("="*50)
        
        # List prospects
        self.run_test("List all prospects", "GET", "prospects", 200)
        
        # Create a prospect (if we have a project)
        if self.created_project_id:
            prospect_data = {
                "project_id": self.created_project_id,
                "company_name": "Test Company",
                "contact_name": "John Doe",
                "email": "john@testcompany.com",
                "phone": "+1234567890",
                "title": "CEO",
                "domain": "testcompany.com"
            }
            
            success, response = self.run_test(
                "Create prospect",
                "POST",
                "prospects",
                200,
                data=prospect_data
            )
            
            if success and 'id' in response:
                prospect_id = response['id']
                print(f"   Created prospect ID: {prospect_id}")
                
                # Get specific prospect
                self.run_test(
                    "Get prospect by ID",
                    "GET",
                    f"prospects/{prospect_id}",
                    200
                )

    def test_csv_upload_endpoints(self):
        """Test CSV upload functionality"""
        print("\n" + "="*50)
        print("TESTING CSV UPLOAD")
        print("="*50)
        
        # Create a simple CSV for testing
        csv_content = "company_name,contact_name,email,phone\nTest Corp,Jane Smith,jane@testcorp.com,555-1234\nAnother Co,Bob Johnson,bob@another.com,555-5678"
        
        # Test CSV parsing
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        success, response = self.run_test(
            "Parse CSV file",
            "POST",
            "prospects/upload/parse",
            200,
            files=files
        )
        
        if success and 'headers' in response:
            print(f"   CSV headers: {response['headers']}")
            print(f"   Preview rows: {len(response.get('preview', []))}")

    def test_stats_endpoints(self):
        """Test statistics endpoints"""
        print("\n" + "="*50)
        print("TESTING STATISTICS")
        print("="*50)
        
        success, response = self.run_test("Get overview stats", "GET", "stats/overview", 200)
        
        if success:
            print(f"   Stats: {json.dumps(response, indent=2)}")

    def test_tasks_endpoints(self):
        """Test tasks endpoints"""
        print("\n" + "="*50)
        print("TESTING TASKS")
        print("="*50)
        
        # List all tasks
        self.run_test("List all tasks", "GET", "tasks", 200)
        
        # Get today's tasks
        self.run_test("Get today's tasks", "GET", "tasks/today", 200)

    def test_export_endpoints(self):
        """Test export endpoints"""
        print("\n" + "="*50)
        print("TESTING EXPORT")
        print("="*50)
        
        # Test activity export
        self.run_test("Export activity", "GET", "export/activity", 200)
        
        # Test prospects export
        self.run_test("Export prospects", "GET", "export/prospects", 200)

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        # Delete created seat
        if self.created_seat_id:
            self.run_test(
                "Delete test seat",
                "DELETE",
                f"users/{self.created_seat_id}",
                200
            )
        
        # Delete created project
        if self.created_project_id:
            self.run_test(
                "Delete test project",
                "DELETE",
                f"projects/{self.created_project_id}",
                200
            )

def main():
    print("🚀 Starting ABM Blinder API Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = ABMBlinder_APITester()
    
    # Run all tests
    tester.test_health_check()
    
    if not tester.test_authentication():
        print("\n❌ Authentication failed - stopping tests")
        return 1
    
    tester.test_user_management()
    tester.test_project_management()
    tester.test_prospects_management()
    tester.test_csv_upload_endpoints()
    tester.test_stats_endpoints()
    tester.test_tasks_endpoints()
    tester.test_export_endpoints()
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print final results
    print("\n" + "="*60)
    print("FINAL TEST RESULTS")
    print("="*60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"✅ Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())