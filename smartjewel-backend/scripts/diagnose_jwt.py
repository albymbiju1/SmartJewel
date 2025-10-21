#!/usr/bin/env python3
"""
Script to diagnose JWT and admin user setup issues
"""
import os
import sys
import json
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.security import verify_password, hash_password
from app.config import Config
from flask_jwt_extended import create_access_token

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel_dev")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this-in-production")

def diagnose():
    """Run diagnostic checks"""
    print("=" * 60)
    print("JWT and Admin User Diagnostic")
    print("=" * 60)
    
    # Connect to MongoDB
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        client.admin.command('ping')
        db = client[MONGO_DB_NAME]
        print(f"✓ MongoDB connection successful to {MONGO_DB_NAME}")
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        return
    
    # Check admin role
    print("\n--- Checking Admin Role ---")
    admin_role = db.roles.find_one({"role_name": "Admin"})
    if admin_role:
        print(f"✓ Admin role exists")
        print(f"  - _id: {admin_role['_id']}")
        print(f"  - permissions: {admin_role.get('permissions', 'NOT SET')}")
    else:
        print(f"✗ Admin role not found. Creating...")
        admin_role = {
            "role_name": "Admin",
            "permissions": ["*"]
        }
        result = db.roles.insert_one(admin_role)
        admin_role["_id"] = result.inserted_id
        print(f"✓ Admin role created with _id: {admin_role['_id']}")
    
    # Check admin user
    print("\n--- Checking Admin User ---")
    admin_user = db.users.find_one({"email": "testadmin@smartjewel.com"})
    if admin_user:
        print(f"✓ Admin user exists: {admin_user['email']}")
        print(f"  - _id: {admin_user['_id']}")
        print(f"  - status: {admin_user.get('status', 'NOT SET')}")
        print(f"  - roles: {admin_user.get('roles', 'NOT SET')}")
        print(f"  - permissions: {admin_user.get('permissions', 'NOT SET')}")
        print(f"  - role._id: {admin_user.get('role', {}).get('_id', 'NOT SET')}")
        print(f"  - role.role_name: {admin_user.get('role', {}).get('role_name', 'NOT SET')}")
    else:
        print(f"✗ Admin user not found")
        return
    
    # Test JWT creation
    print("\n--- Testing JWT Creation ---")
    try:
        from flask import Flask
        app = Flask(__name__)
        app.config['JWT_SECRET_KEY'] = JWT_SECRET
        app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # No expiration for testing
        
        from flask_jwt_extended import JWTManager
        jwt_manager = JWTManager(app)
        
        with app.app_context():
            # Simulate login process
            identity = str(admin_user["_id"])
            
            role_doc = db.roles.find_one({"_id": admin_user["role"]["_id"]}) if admin_user.get("role") else None
            roles_claim = admin_user.get("roles", [])
            perms_claim = role_doc.get("permissions", []) if role_doc else admin_user.get("permissions", [])
            
            claims = {
                "role": admin_user.get("role"),
                "roles": roles_claim,
                "perms": perms_claim,
                "email": admin_user.get("email"),
                "full_name": admin_user.get("full_name"),
            }
            
            print(f"Claims to be included in JWT:")
            print(f"  - identity (user_id): {identity}")
            print(f"  - roles: {claims['roles']}")
            print(f"  - perms: {claims['perms']}")
            print(f"  - email: {claims['email']}")
            
            # Create token
            token = create_access_token(identity=identity, additional_claims=claims)
            print(f"\n✓ Access token created successfully")
            print(f"  - Token length: {len(token)} characters")
            print(f"  - Token (first 50 chars): {token[:50]}...")
            
            # Decode to verify
            import jwt
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            print(f"\n✓ Token decoded successfully")
            print(f"  - sub (identity): {decoded.get('sub')}")
            print(f"  - roles: {decoded.get('roles')}")
            print(f"  - perms: {decoded.get('perms')}")
            print(f"  - email: {decoded.get('email')}")
            
    except Exception as e:
        print(f"✗ JWT creation/verification failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("Diagnostic complete")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    diagnose()