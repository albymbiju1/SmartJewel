import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client[os.getenv("MONGO_DB_NAME", "smartjewel_dev")]

# Define roles with their permissions
roles = [
    {
        "role_name": "Customer",
        "permissions": ["profile.read", "profile.update", "orders.read", "orders.create"]
    },
    {
        "role_name": "Staff_L1",
        "permissions": ["inventory.read", "inventory.create", "inventory.update", "orders.read"]
    },
    {
        "role_name": "Staff_L2", 
        "permissions": ["inventory.read", "inventory.create", "inventory.update", "orders.read", "orders.update"]
    },
    {
        "role_name": "Staff_L3",
        "permissions": ["inventory.read", "inventory.create", "inventory.update", "inventory.export", "inventory.flow", "inventory.tag.assign", "inventory.location.read", "inventory.valuation.read", "inventory.bom.manage", "orders.read", "orders.update", "orders.export"]
    },
    {
        "role_name": "Admin",
        "permissions": ["*"]
    }
]

# Insert roles if they don't exist
for role in roles:
    existing = db.roles.find_one({"role_name": role["role_name"]})
    if not existing:
        db.roles.insert_one(role)
        print(f"Created role: {role['role_name']}")
    else:
        print(f"Role already exists: {role['role_name']}")

print("Role initialization complete.")