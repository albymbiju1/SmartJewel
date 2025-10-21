#!/usr/bin/env python3
"""
Script to create a test admin user for testing purposes
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.security import hash_password

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel_dev")

def create_test_admin():
    """Create a test admin user"""
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]

    # Get the Admin role
    admin_role = db.roles.find_one({"role_name": "Admin"})
    if not admin_role:
        print("Creating Admin role...")
        admin_role = {
            "role_name": "Admin",
            "permissions": ["*"]
        }
        result = db.roles.insert_one(admin_role)
        admin_role["_id"] = result.inserted_id

    # Test admin credentials
    admin_email = "testadmin@smartjewel.com"
    admin_password = "testadmin123"
    admin_name = "Test Admin"

    # Admin user data
    admin_user = {
        "full_name": admin_name,
        "email": admin_email,
        "phone_number": "1234567890",
        "password_hash": hash_password(admin_password),
        "role": {
            "_id": admin_role["_id"],
            "role_name": "Admin"
        },
        "roles": ["Admin"],
        "permissions": ["*"],
        "status": "active",
        "created_at": datetime.utcnow(),
        "last_login": None
    }

    # Check if admin already exists
    existing = db.users.find_one({"email": admin_user["email"]})
    if not existing:
        db.users.insert_one(admin_user)
        print(f"Created test admin user: {admin_email} with password: {admin_password}")
    else:
        print(f"Test admin user already exists: {admin_email}")

    client.close()

if __name__ == "__main__":
    create_test_admin()