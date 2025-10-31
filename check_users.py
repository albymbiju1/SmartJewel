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
    
    # Check users collection
    users_collection = db['users']
    users = list(users_collection.find())
    
    print(f"\nFound {len(users)} users:")
    for user in users:
        print(f"- ID: {user.get('_id')}")
        print(f"  Email: {user.get('email')}")
        print(f"  Full Name: {user.get('full_name')}")
        print(f"  Role: {user.get('role')}")
        print(f"  Status: {user.get('status')}")
        print(f"  Permissions: {user.get('permissions')}")
        print()
        
    # Check roles collection
    roles_collection = db['roles']
    roles = list(roles_collection.find())
    
    print(f"Found {len(roles)} roles:")
    for role in roles:
        print(f"- ID: {role.get('_id')}")
        print(f"  Role Name: {role.get('role_name')}")
        print(f"  Permissions: {role.get('permissions')}")
        print()
        
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")