"""
Fix Staff_L3 permissions in MongoDB
This script ensures Staff_L3 role has the correct permissions
"""
from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

def main():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    
    # Define Staff_L3 permissions
    staff_l3_permissions = [
        "inventory.read",        # Can read/view inventory items
        "inventory.modify",      # Can create, update, delete items
        "inventory.update",      # Explicit update permission
        "inventory.create",      # Explicit create permission
        "tag.assign",            # Can assign RFID/Barcode tags
        "inventory.flow.view",   # Can view stock movements
    ]
    
    # Update Staff_L3 role
    print("\nUpdating Staff_L3 role...")
    result = db.roles.update_one(
        {"role_name": "Staff_L3"},
        {"$set": {"permissions": staff_l3_permissions}},
        upsert=True
    )
    
    if result.matched_count > 0:
        print(f"✅ Updated existing Staff_L3 role")
    elif result.upserted_id:
        print(f"✅ Created new Staff_L3 role with ID: {result.upserted_id}")
    
    # Verify the update
    staff_l3_role = db.roles.find_one({"role_name": "Staff_L3"})
    if staff_l3_role:
        print(f"\n📋 Staff_L3 Role Document:")
        print(f"   _id: {staff_l3_role['_id']}")
        print(f"   role_name: {staff_l3_role['role_name']}")
        print(f"   permissions: {staff_l3_role.get('permissions', [])}")
    else:
        print("❌ Staff_L3 role not found!")
        return
    
    # Check for Staff_L3 users
    print("\n👥 Checking for Staff_L3 users...")
    staff_l3_users = list(db.users.find({"role.role_name": "Staff_L3"}))
    
    if staff_l3_users:
        print(f"   Found {len(staff_l3_users)} Staff_L3 user(s):")
        for user in staff_l3_users:
            print(f"   - {user.get('email')} (ID: {user['_id']})")
            print(f"     Status: {user.get('status', 'N/A')}")
            print(f"     Role: {user.get('role', {}).get('role_name', 'N/A')}")
    else:
        print("   No Staff_L3 users found")
        print("\n💡 To create a Staff_L3 user, use one of these methods:")
        print("   1. Register a new user and update their role in MongoDB")
        print("   2. Use the admin panel to create staff users")
    
    print("\n" + "="*60)
    print("✅ PERMISSIONS UPDATE COMPLETE!")
    print("="*60)
    print("\n⚠️  IMPORTANT: Staff_L3 users must LOGOUT and LOGIN again")
    print("   to get a new JWT token with updated permissions!")
    print("\n")
    
    client.close()

if __name__ == "__main__":
    main()
