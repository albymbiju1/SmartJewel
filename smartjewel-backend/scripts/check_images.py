from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['smartjewel_dev']

items = list(db.items.find().limit(5))
print("Sample image paths from database:")
for item in items:
    print(f"SKU: {item.get('sku')}, Image: {item.get('image')}")
