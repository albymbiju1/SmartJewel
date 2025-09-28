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
        print(f"Got token: {token[:20]}...")

        # Now call refresh gold rate
        refresh_url = "http://localhost:5000/market/refresh-gold-rate"
        headers = {"Authorization": f"Bearer {token}"}

        refresh_resp = requests.post(refresh_url, headers=headers)
        print(f"Refresh status: {refresh_resp.status_code}")
        print(f"Refresh response: {refresh_resp.json()}")
    else:
        print(f"Login failed: {login_resp.text}")
except Exception as e:
    print(f"Error: {e}")