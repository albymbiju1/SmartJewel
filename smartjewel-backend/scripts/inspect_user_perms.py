from pymongo import MongoClient
from bson import ObjectId
import os, re, sys

with open('.env') as f:
    env_text = f.read()

match = re.search(r'MONGODB_URI=(.+)', env_text)
mongo_uri = match.group(1).strip() if match else 'mongodb://localhost:27017'
match2 = re.search(r'MONGO_DB_NAME=(.+)', env_text)
db_name = match2.group(1).strip() if match2 else 'smartjewel'

client = MongoClient(mongo_uri)
db = client[db_name]

email = sys.argv[1] if len(sys.argv) > 1 else "midhunsuresh2026@mca.ajce.in"
user = db.users.find_one({"email": email})
if not user:
    print(f"User not found: {email}")
    sys.exit(1)

print("=== USER DOCUMENT ===")
print(f"  _id:         {user['_id']} (type: {type(user['_id']).__name__})")
print(f"  email:       {user.get('email')}")
print(f"  roles:       {user.get('roles')}")
print(f"  permissions: {user.get('permissions')}")
role = user.get("role", {})
print(f"  role._id:    {role.get('_id')!r} (type: {type(role.get('_id')).__name__})")
print(f"  role.name:   {role.get('role_name')}")

raw_role_id = role.get("_id")
print()
print("=== ROLE LOOKUP ===")

# Try 1: direct
r1 = db.roles.find_one({"_id": raw_role_id})
print(f"  find_one(_id=raw) -> {r1}")

# Try 2: ObjectId coerce
r2 = None
try:
    r2 = db.roles.find_one({"_id": ObjectId(raw_role_id)})
    print(f"  find_one(_id=ObjectId(raw)) -> permissions: {r2.get('permissions') if r2 else None}")
except Exception as e:
    print(f"  ObjectId coerce failed: {e}")

# Try 3: by role_name
r3 = db.roles.find_one({"role_name": role.get("role_name")})
print(f"  find_one(role_name={role.get('role_name')!r}) -> permissions: {r3.get('permissions') if r3 else None}")

print()
print("=== ALL ROLES IN DB ===")
for r in db.roles.find():
    print(f"  {r['role_name']}: _id={r['_id']} (type:{type(r['_id']).__name__}) perms={r.get('permissions')}")

print()
print("=== FIX: updating user permissions directly ===")
CORRECT_PERMS = [
    "discount.approve", "product.manage", "analytics.view.store",
    "shift.view", "orders.manage", "appointments.manage",
    "inventory.read", "inventory.location.read",
]
result = db.users.update_one({"_id": user["_id"]}, {"$set": {"permissions": CORRECT_PERMS}})
print(f"  Modified: {result.modified_count}")
print(f"  New permissions set: {CORRECT_PERMS}")
