import pymongo

# Database configuration
MONGODB_URI = "mongodb+srv://smartjewel27:smartjewel27@cluster0.tcik4d7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
MONGO_DB_NAME = "SmartJewel"

try:
    # Connect to MongoDB
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    
    # Check connection
    client.admin.command('ping')
    print("Connected to MongoDB successfully!")
    
    # Update admin user permissions
    result = db['users'].update_one(
        {'email': 'admin@smartjewel.com'},
        {'$set': {'permissions': ['*']}}
    )
    
    print(f"Updated admin user permissions, matched: {result.matched_count}, modified: {result.modified_count}")
        
except Exception as e:
    print(f"Error: {e}")