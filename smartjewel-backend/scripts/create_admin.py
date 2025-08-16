import os
from pymongo import MongoClient
from dotenv import load_dotenv
from app.utils.security import hash_password

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client[os.getenv("MONGO_DB_NAME", "smartjewel_dev")]

email = input("Admin email: ").strip().lower()
name = input("Admin name: ").strip()
password = input("Admin password: ").strip()

user = {
    "email": email,
    "name": name,
    "password_hash": hash_password(password),
    "roles": ["admin"],
    "permissions": ["*"],  # temporary; narrow later
    "is_active": True,
    "branch_id": "HQ01",
}
db.users.insert_one(user)
print("Admin user created.")