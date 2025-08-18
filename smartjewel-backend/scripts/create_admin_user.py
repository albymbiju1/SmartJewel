import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.utils.security import hash_password

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client[os.getenv("MONGO_DB_NAME", "smartjewel_dev")]

# Admin user details
admin_email = "albymbiju2002@gmail.com"
admin_name = "Alby M Biju"
admin_phone = "8078534918"
admin_password = "Albyser17"

# Check if admin user already exists
existing_admin = db.users.find_one({"email": admin_email.lower()})
if existing_admin:
    print(f"Admin user with email {admin_email} already exists!")
    exit(1)

# Get the Admin role
admin_role = db.roles.find_one({"role_name": "Admin"})
if not admin_role:
    print("Admin role not found! Please run init_roles.py first.")
    exit(1)

# Create admin user document
admin_user = {
    "full_name": admin_name,
    "email": admin_email.lower(),
    "phone_number": admin_phone,
    "password_hash": hash_password(admin_password),
    "role": {
        "_id": admin_role["_id"],
        "role_name": admin_role["role_name"]
    },
    "status": "active",
    "created_at": db.command("isMaster")['localTime'] if 'localTime' in db.command("isMaster") else None
}

# Insert the admin user
result = db.users.insert_one(admin_user)
print(f"Admin user created successfully!")
print(f"User ID: {result.inserted_id}")
print(f"Name: {admin_name}")
print(f"Email: {admin_email}")
print(f"Role: {admin_role['role_name']}")
print(f"Permissions: {admin_role['permissions']}")