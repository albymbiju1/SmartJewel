"""
Debug MongoDB connection and check databases
"""
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

def main():
    client = MongoClient(MONGODB_URI)
    
    print("\n🔍 MongoDB Connection Debug:")
    print("=" * 80)
    print(f"URI: {MONGODB_URI[:50]}...")
    print(f"Configured DB Name: {MONGO_DB_NAME}")
    
    # List all databases
    print("\n📚 Available Databases:")
    db_list = client.list_database_names()
    for db_name in db_list:
        print(f"   - {db_name}")
    
    # Try configured database
    db = client[MONGO_DB_NAME]
    collections = db.list_collection_names()
    
    print(f"\n📦 Collections in '{MONGO_DB_NAME}':")
    if collections:
        for coll in collections:
            count = db[coll].count_documents({})
            print(f"   - {coll}: {count} documents")
    else:
        print("   No collections found")
    
    # Check users specifically
    if "users" in collections:
        users_count = db.users.count_documents({})
        print(f"\n👥 Users Count: {users_count}")
        
        if users_count > 0:
            print("\nSample Users:")
            for user in db.users.find({}, {"email": 1, "role": 1}).limit(5):
                print(f"   - {user.get('email')} (Role: {user.get('role', {}).get('role_name', 'N/A')})")
    
    # Check roles
    if "roles" in collections:
        roles_count = db.roles.count_documents({})
        print(f"\n🎭 Roles Count: {roles_count}")
        
        if roles_count > 0:
            print("\nAvailable Roles:")
            for role in db.roles.find({}, {"role_name": 1, "permissions": 1}):
                print(f"   - {role.get('role_name')}: {role.get('permissions', [])}")
    
    print("\n" + "=" * 80)
    client.close()

if __name__ == "__main__":
    main()
