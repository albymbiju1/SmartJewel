"""
Check user role and permissions in MongoDB
Usage: python check_user_role.py <email>
"""
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

def check_user(email):
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    
    email = email.lower().strip()
    
    print(f"\n🔍 Searching for user: {email}")
    
    # Find user
    user = db.users.find_one({"email": email})
    
    if not user:
        print(f"❌ User not found: {email}")
        print("\n📋 Available users:")
        for u in db.users.find({}, {"email": 1, "role": 1, "status": 1}).limit(10):
            print(f"   - {u.get('email')} (Role: {u.get('role', {}).get('role_name', 'N/A')}, Status: {u.get('status', 'N/A')})")
        client.close()
        return
    
    print(f"\n✅ User found!")
    print(f"\n📋 User Details:")
    print(f"   Email: {user.get('email')}")
    print(f"   Name: {user.get('full_name', 'N/A')}")
    print(f"   Status: {user.get('status', 'N/A')}")
    
    # Check role
    role_info = user.get('role', {})
    role_name = role_info.get('role_name', 'N/A')
    role_id = role_info.get('_id')
    
    print(f"\n🎭 Role Information:")
    print(f"   Role Name: {role_name}")
    print(f"   Role ID: {role_id}")
    
    # Get full role document
    role_doc = None
    if role_id:
        role_doc = db.roles.find_one({"_id": role_id})
        if role_doc:
            print(f"\n📜 Role Document:")
            print(f"   Role Name: {role_doc.get('role_name')}")
            print(f"   Permissions: {role_doc.get('permissions', [])}")
        else:
            print(f"\n⚠️  Role document not found for ID: {role_id}")
    
    # Check if user has direct permissions
    user_perms = user.get('permissions', [])
    user_roles = user.get('roles', [])
    
    if user_perms:
        print(f"\n🔑 Direct User Permissions: {user_perms}")
    if user_roles:
        print(f"\n👥 User Roles: {user_roles}")
    
    # Check what would be in JWT
    print(f"\n🎫 What JWT Token Would Contain:")
    if role_doc and role_doc.get('permissions'):
        print(f"   perms: {role_doc.get('permissions')}")
    elif user_perms:
        print(f"   perms: {user_perms}")
    else:
        print(f"   perms: []")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    if role_name != "Staff_L3":
        print(f"   ⚠️  User is currently '{role_name}', not 'Staff_L3'")
        print(f"   → Run: python scripts/create_staff_l3_user.py {email}")
        print(f"   → This will update the user to Staff_L3 role")
    else:
        if role_doc and 'inventory.modify' in role_doc.get('permissions', []):
            print(f"   ✅ User has correct role and permissions!")
            print(f"   ⚠️  User must LOGOUT and LOGIN again to get new JWT token")
        else:
            print(f"   ⚠️  Role exists but permissions are missing")
            print(f"   → Run: python scripts/fix_staff_l3_permissions.py")
    
    print("\n")
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n❌ Usage: python check_user_role.py <email>")
        print("\nExample: python check_user_role.py user@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    check_user(email)
