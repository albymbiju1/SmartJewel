import os
import sys
from pymongo import MongoClient
from bson import ObjectId
import json

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['smartjewel']

# List all users
users = list(db.users.find({}))
print(f"Found {len(users)} users:")
for user in users:
    print(f"- {user.get('full_name', user.get('name', 'N/A'))} ({user.get('email', 'N/A')}) - Role: {user.get('role', 'N/A')} - Status: {user.get('status', 'N/A')}")
    # Print the raw user data for the first few users
    if len(users) <= 5 or users.index(user) < 2:
        print(f"  Raw data: {json.dumps(user, default=str, indent=2)}")