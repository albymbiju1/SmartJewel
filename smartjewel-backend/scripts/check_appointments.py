from pymongo import MongoClient
import re, json

with open('.env') as f:
    t = f.read()
uri = re.search(r'MONGODB_URI=(.+)', t).group(1).strip()
dbn = re.search(r'MONGO_DB_NAME=(.+)', t).group(1).strip()
db = MongoClient(uri)[dbn]

print("=== STAFF_L1 STORE_IDs ===")
managers = list(db.users.find({'role.role_name': 'Staff_L1'}))
for m in managers:
    sid = m.get('store_id')
    print(f"email={m.get('email')} | store_id={sid!r} | type={type(sid).__name__}")

print("\n=== ALL APPOINTMENTS ===")
total = db.appointments.count_documents({})
print(f"Total: {total}")
for a in db.appointments.find():
    print(f"  store_id={a.get('store_id')!r} | customer={a.get('customer_name')} | status={a.get('status')}")

print("\n=== ALL STORES ===")
for s in db.stores.find():
    print(f"  _id={s['_id']} | name={s.get('name')}")
