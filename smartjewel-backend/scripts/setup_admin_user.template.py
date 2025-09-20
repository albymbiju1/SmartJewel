#!/usr/bin/env python3
"""
Template script to create an admin user
IMPORTANT: This is a template file. Copy and modify for your specific needs.
DO NOT commit files with real credentials to version control.
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
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

def create_admin_user():
    """Create an admin user - MODIFY THIS FUNCTION WITH YOUR CREDENTIALS"""
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
    
    # MODIFY THESE VALUES FOR YOUR SETUP
    admin_email = "YOUR_ADMIN_EMAIL@example.com"  # Change this
    admin_password = "YOUR_SECURE_PASSWORD"       # Change this
    admin_name = "Your Admin Name"                # Change this
    admin_phone = "1234567890"                    # Change this
    
    # Admin user data
    admin_user = {
        "full_name": admin_name,
        "email": admin_email,
        "phone_number": admin_phone,
        "password_hash": hash_password(admin_password),
        "role": {
            "_id": admin_role["_id"],
            "role_name": "Admin"
        },
        "status": "active",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    
    # Check if admin already exists
    existing = db.users.find_one({"email": admin_user["email"]})
    if not existing:
        db.users.insert_one(admin_user)
        print(f"Created admin user: {admin_email}")
    else:
        print(f"Admin user already exists: {admin_email}")
    
    client.close()

if __name__ == "__main__":
    print("WARNING: This is a template file!")
    print("Please copy this file, modify the credentials, and run the copy.")
    print("Never commit files with real credentials to version control.")
    # Uncomment the line below after modifying the credentials
    # create_admin_user()

