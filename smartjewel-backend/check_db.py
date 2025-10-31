from app.init import create_app
from bson import ObjectId

app = create_app()
db = app.extensions['mongo_db']

print('=== DATABASE STRUCTURE ===')
print('Items count:', db.items.count_documents({}))
print('Stock levels count:', db.stock_levels.count_documents({}))
print('Stock movements count:', db.stock_movements.count_documents({}))
print('Stores count:', db.stores.count_documents({}))
print('Locations count:', db.locations.count_documents({}))
print('')

print('Sample stock level:')
stock_level = db.stock_levels.find_one()
print(stock_level)
print('')

print('Sample item:')
item = db.items.find_one({}, {'sku': 1, 'name': 1, 'quantity': 1})
print(item)
print('')

print('Stores:')
stores = list(db.stores.find({}, {'name': 1}))
for store in stores:
    print(f"  - {store['name']} (ID: {store['_id']})")

print('\nLocations:')
locations = list(db.locations.find({}, {'name': 1}))
for location in locations:
    print(f"  - {location['name']} (ID: {location['_id']})")

# Check if there are stock levels for each store
print('\nStock levels per store:')
for store in stores:
    store_id = store['_id']
    count = db.stock_levels.count_documents({'location_id': store_id})
    print(f"  - {store['name']}: {count} items")

# Check if there are stock levels for each location
print('\nStock levels per location:')
for location in locations:
    location_id = location['_id']
    count = db.stock_levels.count_documents({'location_id': location_id})
    print(f"  - {location['name']}: {count} items")

# Show all stock levels with their location IDs
print('\nAll stock levels:')
for sl in db.stock_levels.find():
    print(f"  - Item ID: {sl.get('item_id')}, Location ID: {sl.get('location_id')}, Qty: {sl.get('quantity')}")

print('\nSample stock movements:')
movements = list(db.stock_movements.find().limit(3))
for m in movements:
    print(f"  - Item: {m.get('item_id')}, From: {m.get('from_location_id')}, To: {m.get('to_location_id')}, Type: {m.get('type')}, Qty: {m.get('quantity')}")

print('\nAll stores with IDs:')
for store in db.stores.find():
    print(f"  - {store['_id']}: {store['name']}")