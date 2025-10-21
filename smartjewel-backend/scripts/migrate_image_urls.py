"""
Migrate image URLs from absolute (http://127.0.0.1:5000/...) to relative (/static/uploads/...)
"""
from pymongo import MongoClient

def migrate_image_urls():
    client = MongoClient('mongodb://localhost:27017')
    db = client['smartjewel_dev']
    
    # Find all items with absolute URLs
    items_with_absolute_urls = db.items.find({
        'image': {'$regex': '^http://127.0.0.1:5000'}
    })
    
    count = 0
    for item in items_with_absolute_urls:
        old_image = item.get('image', '')
        # Replace the absolute URL with relative path
        new_image = old_image.replace('http://127.0.0.1:5000', '')
        
        # Update the item
        db.items.update_one(
            {'_id': item['_id']},
            {'$set': {'image': new_image}}
        )
        count += 1
        print(f"Updated: {old_image} -> {new_image}")
    
    print(f"\nMigration complete! Updated {count} items.")
    
    # Verify the changes
    remaining = db.items.count_documents({
        'image': {'$regex': '^http://127.0.0.1:5000'}
    })
    print(f"Remaining items with absolute URLs: {remaining}")

if __name__ == '__main__':
    migrate_image_urls()
