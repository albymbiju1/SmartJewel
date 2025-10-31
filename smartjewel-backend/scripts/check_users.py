from pymongo import MongoClient
import os
from bson import ObjectId

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

def main():
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGO_DB_NAME]
        
        # Test connection
        client.admin.command('ping')
        print("Connected to MongoDB successfully")
        
        # Check roles
        print("\nRoles in database:")
        roles = list(db.roles.find())
        staff_l1_role = None
        for role in roles:
            print(f"- {role.get('role_name')}: {role.get('permissions')}")
            if role.get('role_name') == 'Staff_L1':
                staff_l1_role = role
        
        # Check if we have any store manager users
        print("\nUsers in database:")
        users = list(db.users.find({}, {'email': 1, 'roles': 1, 'role': 1}).limit(10))
        store_managers = []
        for user in users:
            print(f"- {user.get('email')}: roles={user.get('roles')}, role={user.get('role')}")
            if user.get('role') and user['role'].get('role_name') == 'Staff_L1':
                store_managers.append(user)
        
        if not store_managers:
            print("\nNo store manager users found. You'll need to create one through the admin interface.")
        else:
            print(f"\nFound {len(store_managers)} store manager users.")
            
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

if __name__ == "__main__":
    main()