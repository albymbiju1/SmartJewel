#!/usr/bin/env python3
"""
Test script to manually trigger the scheduler job for gold rate updates
"""
import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_ENDPOINT = "/auth/login"
TRIGGER_ENDPOINT = "/market/trigger-scheduler-job"

def login(email, password):
    """Login and get access token"""
    url = f"{BASE_URL}{LOGIN_ENDPOINT}"
    payload = {
        "email": email,
        "password": password
    }

    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def trigger_scheduler_job(token):
    """Trigger the scheduler job"""
    url = f"{BASE_URL}{TRIGGER_ENDPOINT}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    try:
        print(f"Making request to: {url}")
        print(f"Headers: {headers}")
        response = requests.post(url, headers=headers)
        print(f"Trigger response: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        try:
            json_response = response.json()
            print(f"JSON Response: {json_response}")
            return response.status_code == 200
        except:
            print("Response is not JSON")
            return False
    except Exception as e:
        print(f"Trigger error: {e}")
        return False

def main():
    if len(sys.argv) != 3:
        print("Usage: python test_scheduler_trigger.py <email> <password>")
        print("Example: python test_scheduler_trigger.py admin@smartjewel.com mypassword")
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]

    print(f"Attempting to login as: {email}")

    # Login
    token = login(email, password)
    if not token:
        print("Failed to login")
        sys.exit(1)

    print("Login successful, triggering scheduler job...")

    # Trigger job
    success = trigger_scheduler_job(token)
    if success:
        print("Scheduler job triggered successfully!")
    else:
        print("Failed to trigger scheduler job")

if __name__ == "__main__":
    main()