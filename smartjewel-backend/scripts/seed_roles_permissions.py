from pymongo import MongoClient, ASCENDING
import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

ROLE_PERMS = {
    "Admin": ["*"],
    # Store Manager (Staff Type 1)
    "Staff_L1": [
        "discount.approve",
        "product.manage",
        "analytics.view.store",
        "shift.view",
    ],
    # Sales Executive (Staff Type 2)
    "Staff_L2": [
        "billing.use_pos",
        "customer.view",
        "assist.ai",
        "tryon.use",
    ],
    # Inventory Staff (Staff Type 3)
    "Staff_L3": [
        "inventory.modify",
        "tag.assign",
        "inventory.flow.view",
    ],
    # Customer baseline
    "Customer": ["profile.read", "orders.read"],
}

SUPPORTED_PERMISSIONS = sorted({p for v in ROLE_PERMS.values() for p in v if p != "*"})


def main():
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]

    # Create permissions collection items (optional, for UI listing)
    for key in SUPPORTED_PERMISSIONS:
        db.permissions.update_one({"key": key}, {"$setOnInsert": {"key": key, "description": key}}, upsert=True)

    # Upsert roles with permissions
    for role_name, perms in ROLE_PERMS.items():
        db.roles.update_one(
            {"role_name": role_name},
            {"$set": {"role_name": role_name, "permissions": perms}},
            upsert=True,
        )

    # Useful indexes
    db.users.create_index([("email", ASCENDING)], unique=True, name="uniq_email")
    db.users.create_index([("role._id", ASCENDING)], name="role_id")
    db.users.create_index([("status", ASCENDING)], name="status")

    db.shift_schedules.create_index([("staff_id", ASCENDING)], name="staff_id")
    db.shift_schedules.create_index([("store_id", ASCENDING)], name="store_id")

    db.shift_logs.create_index([("staff_id", ASCENDING), ("clock_in", ASCENDING)], name="staff_clock_in")
    db.shift_logs.create_index([("store_id", ASCENDING)], name="store_id")

    print("Seeded roles/permissions and created indexes.")


if __name__ == "__main__":
    main()
