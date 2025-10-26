"""
List all users and their roles in MongoDB
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
    db = client[MONGO_DB_NAME]
    
    print("\n📋 All Users in Database:")
    print("=" * 80)
    
    users = list(db.users.find({}, {"email": 1, "full_name": 1, "role": 1, "status": 1, "firebase_uid": 1}))
    
    if not users:
        print("No users found in database")
    else:
        for i, user in enumerate(users, 1):
            email = user.get('email', 'N/A')
            name = user.get('full_name', 'N/A')
            role_name = user.get('role', {}).get('role_name', 'N/A')
            status = user.get('status', 'N/A')
            is_firebase = '🔥' if user.get('firebase_uid') else '  '
            
            print(f"\n{i}. {is_firebase} {email}")
            print(f"   Name: {name}")
            print(f"   Role: {role_name}")
            print(f"   Status: {status}")
    
    print("\n" + "=" * 80)
    print(f"Total users: {len(users)}")
    print("\n💡 To check a specific user's permissions:")
    print("   python scripts/check_user_role.py <email>")
    print("\n💡 To update a user to Staff_L3:")
    print("   python scripts/create_staff_l3_user.py <email>")
    print("\n")
    
    client.close()

if __name__ == "__main__":
    main()
