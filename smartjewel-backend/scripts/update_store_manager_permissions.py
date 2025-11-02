from pymongo import MongoClient
import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

# New permissions for Store Manager (Staff_L1)
NEW_STAFF_L1_PERMISSIONS = [
    "discount.approve",
    "product.manage",
    "analytics.view.store",
    "shift.view",
    "orders.manage",
    "appointments.manage",
    "inventory.read",  # For viewing products and inventory dashboard
    "inventory.location.read",  # For viewing store locations
]

def main():
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    
    # Find the Staff_L1 role
    staff_l1_role = db.roles.find_one({"role_name": "Staff_L1"})
    if not staff_l1_role:
        print("Staff_L1 role not found!")
        return
    
    role_id = staff_l1_role["_id"]
    
    # Update the role permissions
    db.roles.update_one(
        {"_id": role_id},
        {"$set": {"permissions": NEW_STAFF_L1_PERMISSIONS}}
    )
    print(f"Updated Staff_L1 role permissions: {NEW_STAFF_L1_PERMISSIONS}")
    
    # Update all users with Staff_L1 role
    updated_users = 0
    users = db.users.find({"role._id": str(role_id)})
    for user in users:
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"permissions": NEW_STAFF_L1_PERMISSIONS}}
        )
        updated_users += 1
    
    print(f"Updated {updated_users} store manager users with new permissions")
    print("Done!")

if __name__ == "__main__":
    main()