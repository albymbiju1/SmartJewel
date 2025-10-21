#!/usr/bin/env python3
"""
Script to test the store API with proper authentication
"""
import os
import sys
import requests
import json
from pymongo import MongoClient
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.security import verify_password, hash_password
from app import create_app

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel_dev")
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:5000")

def test_store_api():
    """Test the store API"""
    print("=" * 60)
    print("Testing Store API")
    print("=" * 60)
    
    # Connect to MongoDB
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        client.admin.command('ping')
        db = client[MONGO_DB_NAME]
        print(f"✓ MongoDB connection successful")
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        return
    
    # Ensure admin user exists
    print("\n--- Ensuring Admin User Exists ---")
    admin_role = db.roles.find_one({"role_name": "Admin"})
    if not admin_role:
        admin_role = {
            "role_name": "Admin",
            "permissions": ["*"]
        }
        result = db.roles.insert_one(admin_role)
        admin_role["_id"] = result.inserted_id
    
    admin_user = db.users.find_one({"email": "testadmin@smartjewel.com"})
    if not admin_user:
        print("Creating admin user...")
        admin_user = {
            "full_name": "Test Admin",
            "email": "testadmin@smartjewel.com",
            "phone_number": "1234567890",
            "password_hash": hash_password("testadmin123"),
            "role": {
                "_id": admin_role["_id"],
                "role_name": "Admin"
            },
            "roles": ["Admin"],
            "permissions": ["*"],
            "status": "active",
            "created_at": None,
            "last_login": None
        }
        result = db.users.insert_one(admin_user)
        admin_user["_id"] = result.inserted_id
        print(f"✓ Admin user created")
    else:
        print(f"✓ Admin user exists: {admin_user['email']}")
    
    # Test login
    print("\n--- Testing Login ---")
    try:
        session = requests.Session()
        session.headers.update({'Content-Type': 'application/json'})
        
        login_data = {
            "email": "testadmin@smartjewel.com",
            "password": "testadmin123"
        }
        
        response = session.post(f"{API_BASE}/auth/login", json=login_data)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            login_resp = response.json()
            access_token = login_resp.get("access_token")
            print(f"✓ Login successful")
            print(f"  - Token length: {len(access_token)} characters")
            print(f"  - Token (first 50 chars): {access_token[:50]}...")
            
            user_data = login_resp.get("user", {})
            print(f"  - User: {user_data.get('email')}")
            print(f"  - Roles: {user_data.get('roles')}")
            print(f"  - Perms: {user_data.get('perms')}")
        else:
            print(f"✗ Login failed")
            print(f"  Response: {response.text}")
            return
    except Exception as e:
        print(f"✗ Login test failed: {e}")
        return
    
    # Test store creation
    print("\n--- Testing Store Creation ---")
    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        store_data = {
            "name": f"Test Store {datetime.now().isoformat()}",
            "location": "Test Location",
            "address": "123 Test St",
            "phone": "9999999999",
            "email": "test@store.com",
            "manager": "Test Manager"
        }
        
        response = requests.post(f"{API_BASE}/stores", json=store_data, headers=headers)
        print(f"Store creation response status: {response.status_code}")
        
        if response.status_code == 201:
            print(f"✓ Store created successfully")
            print(f"  Response: {response.json()}")
        else:
            print(f"✗ Store creation failed")
            print(f"  Response: {response.text}")
    except Exception as e:
        print(f"✗ Store creation test failed: {e}")
    
    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    from datetime import datetime
    test_store_api()