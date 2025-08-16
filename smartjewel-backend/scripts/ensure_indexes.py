import os
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv
load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client[os.getenv("MONGO_DB_NAME", "smartjewel_dev")]
db.users.create_index([("email", ASCENDING)], unique=True, name="uniq_email")
db.users.create_index([("branch_id", ASCENDING)], name="branch_idx")
print("Indexes ensured")