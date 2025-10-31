import os
import sys
from pymongo import MongoClient
from bson import ObjectId
import json

# MongoDB connection
client = MongoClient('mongodb+srv://smartjewel27:smartjewel27@cluster0.tcik4d7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
db = client['SmartJewel']

# Find the admin user
admin_user = db.users.find_one({"email": "admin@smartjewel.com"})
if admin_user:
    print("Admin user found:")
    print(json.dumps(admin_user, default=str, indent=2))
else:
    print("Admin user not found")

# Check all staff users
staff_users = list(db.users.find({
    "role.role_name": {"$in": ["Staff_L1", "Staff_L2", "Staff_L3"]}
}))
print(f"\nFound {len(staff_users)} staff users:")
for user in staff_users:
    print(f"- {user.get('full_name', 'N/A')} ({user.get('email', 'N/A')}) - {user.get('role', {}).get('role_name', 'N/A')}")