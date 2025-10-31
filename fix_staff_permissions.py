import pymongo
from bson import ObjectId

# Database configuration
MONGODB_URI = "mongodb+srv://smartjewel27:smartjewel27@cluster0.tcik4d7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
MONGO_DB_NAME = "SmartJewel"

try:
    # Connect to MongoDB
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    
    # Check connection
    client.admin.command('ping')
    print("Connected to MongoDB successfully!")
    
    # Get all roles and create a mapping
    roles_collection = db['roles']
    roles = list(roles_collection.find())
    role_mapping = {str(role['_id']): role for role in roles}
    
    print("Role mapping:")
    for role_id, role in role_mapping.items():
        print(f"  {role_id}: {role['role_name']} -> {role['permissions']}")
    
    # Update users with missing permissions
    users_collection = db['users']
    staff_users = list(users_collection.find({
        "role.role_name": {"$in": ["Staff_L1", "Staff_L2", "Staff_L3"]}
    }))
    
    print(f"\nFound {len(staff_users)} staff users to update:")
    
    for user in staff_users:
        user_id = user['_id']
        role_info = user.get('role', {})
        role_id = str(role_info.get('_id')) if role_info.get('_id') else None
        
        if role_id and role_id in role_mapping:
            role_doc = role_mapping[role_id]
            permissions = role_doc.get('permissions', [])
            
            print(f"Updating user {user.get('email')} ({user.get('full_name')}) with role {role_doc['role_name']}")
            print(f"  Setting permissions: {permissions}")
            
            # Update the user with the correct permissions
            users_collection.update_one(
                {"_id": user_id},
                {"$set": {"permissions": permissions}}
            )
        else:
            print(f"Could not find role for user {user.get('email')}")
    
    print("\nDone updating staff permissions!")
        
except Exception as e:
    print(f"Error: {e}")