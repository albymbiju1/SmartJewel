#!/usr/bin/env python3
"""
Check existing users in the database
"""
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel_dev")

def check_users():
    """Check existing users"""
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]

    users = list(db.users.find({}, {"email": 1, "full_name": 1, "roles": 1, "role": 1, "status": 1}))
    print(f"Found {len(users)} users:")
    for user in users:
        print(f"  Email: {user.get('email')}, Name: {user.get('full_name')}, Status: {user.get('status')}, Roles: {user.get('roles') or user.get('role')}")

    client.close()

if __name__ == "__main__":
    check_users()