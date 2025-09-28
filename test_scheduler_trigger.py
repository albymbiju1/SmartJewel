import requests

# Login to get token
login_url = "http://localhost:5000/auth/login"
login_data = {
    "email": "admin@smartjewel.com",
    "password": "admin123"
}

try:
    login_resp = requests.post(login_url, json=login_data)
    print(f"Login status: {login_resp.status_code}")
    if login_resp.status_code == 200:
        login_json = login_resp.json()
        token = login_json.get("access_token")
        print("Got token, testing scheduler trigger...")

        # Test the new scheduler trigger endpoint
        trigger_url = "http://localhost:5000/market/trigger-scheduler-job"
        headers = {"Authorization": f"Bearer {token}"}

        trigger_resp = requests.post(trigger_url, headers=headers)
        print(f"Trigger status: {trigger_resp.status_code}")
        print(f"Trigger response: {trigger_resp.json()}")
    else:
        print(f"Login failed: {login_resp.text}")
except Exception as e:
    print(f"Error: {e}")