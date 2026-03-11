from pymongo import MongoClient
from bson import ObjectId
import os, re

with open('.env') as f:
    env_text = f.read()

match = re.search(r'MONGODB_URI=(.+)', env_text)
mongo_uri = match.group(1).strip() if match else 'mongodb://localhost:27017'
match2 = re.search(r'MONGO_DB_NAME=(.+)', env_text)
db_name = match2.group(1).strip() if match2 else 'smartjewel'

client = MongoClient(mongo_uri)
db = client[db_name]

CORRECT_PERMS = [
    "discount.approve",
    "product.manage",
    "analytics.view.store",
    "shift.view",
    "orders.manage",
    "appointments.manage",
    "inventory.read",
    "inventory.location.read",
]

# Show the Staff_L1 role document
role = db.roles.find_one({"role_name": "Staff_L1"})
print("Staff_L1 role doc:", role)
print()

# Find all Staff_L1 users
users_by_roles = list(db.users.find({"roles": {"$in": ["Staff_L1"]}}))
users_by_role_name = list(db.users.find({"role.role_name": "Staff_L1"}))

seen = {}
for u in users_by_roles + users_by_role_name:
    seen[str(u["_id"])] = u

print(f"Found {len(seen)} unique Staff_L1 users")
for uid, u in seen.items():
    role_id = (u.get("role") or {}).get("_id")
    print(f"  Email: {u.get('email')}")
    print(f"  role._id: {role_id!r} (type: {type(role_id).__name__})")
    print(f"  permissions: {u.get('permissions')}")
    print()

# Fix each user: update their permissions field to the correct list
updated = 0
for uid, u in seen.items():
    result = db.users.update_one(
        {"_id": u["_id"]},
        {"$set": {"permissions": CORRECT_PERMS}}
    )
    if result.modified_count:
        updated += 1
        print(f"Updated permissions for {u.get('email')}")

print(f"\nDone. Updated {updated} users.")
