from pymongo import MongoClient
import re

with open('.env') as f:
    t = f.read()
uri = re.search(r'MONGODB_URI=(.+)', t).group(1).strip()
dbn = re.search(r'MONGO_DB_NAME=(.+)', t).group(1).strip()
db = MongoClient(uri)[dbn]

CORRECT_PERMS = [
    'discount.approve', 'product.manage', 'analytics.view.store',
    'shift.view', 'orders.manage', 'appointments.manage',
    'inventory.read', 'inventory.location.read',
]

# Print before
role = db.roles.find_one({'role_name': 'Staff_L1'})
print('BEFORE perms:', role.get('permissions') if role else 'ROLE NOT FOUND')

# Update the role document directly
res = db.roles.update_one({'role_name': 'Staff_L1'}, {'$set': {'permissions': CORRECT_PERMS}})
print('Role update modified:', res.modified_count)

# Also update all Staff_L1 users' permissions fallback field
res2 = db.users.update_many(
    {'$or': [{'roles': 'Staff_L1'}, {'role.role_name': 'Staff_L1'}]},
    {'$set': {'permissions': CORRECT_PERMS}}
)
print('Users updated:', res2.modified_count)

# Verify
role2 = db.roles.find_one({'role_name': 'Staff_L1'})
print('AFTER perms:', role2.get('permissions') if role2 else 'ROLE NOT FOUND')
