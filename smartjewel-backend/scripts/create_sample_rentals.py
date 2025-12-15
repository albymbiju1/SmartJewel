"""
Script to create sample rental items for testing the rental feature.

This script:
1. Creates sample items in the items collection with isRentable = True
2. Creates corresponding rental_items in the rental_items collection
"""

from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client['smartjewel']

# Sample rental items data
sample_items = [
    {
        "name": "Royal Gold Necklace",
        "category": "necklace",
        "metal": "gold",
        "purity": "22K",
        "weight": 25.5,
        "weight_unit": "g",
        "description": "Exquisite gold necklace perfect for weddings and special occasions",
        "image": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500",
        "status": "active",
        "isRentable": True,
        "price": 125000,
        "quantity": 1,
        "updated_at": datetime.utcnow()
    },
    {
        "name": "Diamond Studded Earrings",
        "category": "earrings",
        "metal": "gold",
        "purity": "18K",
        "weight": 8.2,
        "weight_unit": "g",
        "description": "Elegant diamond earrings with brilliant cut stones",
        "image": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500",
        "status": "active",
        "isRentable": True,
        "price": 85000,
        "quantity": 1,
        "updated_at": datetime.utcnow()
    },
    {
        "name": "Traditional Bangles Set",
        "category": "bangles",
        "metal": "gold",
        "purity": "22K",
        "weight": 45.0,
        "weight_unit": "g",
        "description": "Stunning set of traditional gold bangles",
        "image": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500",
        "status": "active",
        "isRentable": True,
        "price": 185000,
        "quantity": 1,
        "updated_at": datetime.utcnow()
    },
    {
        "name": "Antique Choker",
        "category": "necklace",
        "metal": "gold",
        "purity": "22K",
        "weight": 32.0,
        "weight_unit": "g",
        "description": "Antique design choker with traditional craftsmanship",
        "image": "https://images.unsplash.com/photo-1601821765780-754fa98637c1?w=500",
        "status": "active",
        "isRentable": True,
        "price": 145000,
        "quantity": 1,
        "updated_at": datetime.utcnow()
    },
    {
        "name": "Wedding Maang Tikka",
        "category": "maang-tikka",
        "metal": "gold",
        "purity": "22K",
        "weight": 12.5,
        "weight_unit": "g",
        "description": "Beautiful maang tikka perfect for brides",
        "image": "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=500",
        "status": "active",
        "isRentable": True,
        "price": 65000,
        "quantity": 1,
        "updated_at": datetime.utcnow()
    }
]

def create_sample_rentals():
    """Create sample rental items in the database."""
    
    print("Creating sample rental items...")
    
    # Clear existing test rental data (optional)
    # db.rental_items.delete_many({"test_data": True})
    
    created_count = 0
    
    for item_data in sample_items:
        # Insert the item
        result = db.items.insert_one(item_data)
        item_id = result.inserted_id
        
        # Create corresponding rental item
        rental_data = {
            "product_id": item_id,
            "rental_price_per_day": int(item_data["price"] * 0.02),  # 2% of item price per day
            "security_deposit": int(item_data["price"] * 0.5),  # 50% of item price as deposit
            "status": "available",
            "test_data": True,
            "created_at": datetime.utcnow()
        }
        
        db.rental_items.insert_one(rental_data)
        created_count += 1
        
        print(f"✓ Created rental item: {item_data['name']}")
        print(f"  - Item ID: {item_id}")
        print(f"  - Rental/day: ₹{rental_data['rental_price_per_day']:,}")
        print(f"  - Deposit: ₹{rental_data['security_deposit']:,}")
        print()
    
    print(f"\n✅ Successfully created {created_count} rental items!")
    print(f"\nYou can now test the rental endpoints:")
    print(f"  - GET http://localhost:5000/api/rentals")
    print(f"  - GET http://localhost:5000/api/rentals/<rental_item_id>")

def list_rental_items():
    """List all rental items in the database."""
    print("\nCurrent rental items in database:")
    print("-" * 80)
    
    rental_items = db.rental_items.find()
    count = 0
    
    for rental in rental_items:
        count += 1
        product = db.items.find_one({"_id": rental["product_id"]})
        if product:
            print(f"\n{count}. {product['name']}")
            print(f"   Rental ID: {rental['_id']}")
            print(f"   Status: {rental['status']}")
            print(f"   Rental/day: ₹{rental['rental_price_per_day']:,}")
            print(f"   Deposit: ₹{rental['security_deposit']:,}")
    
    if count == 0:
        print("No rental items found in database.")
    else:
        print(f"\nTotal: {count} rental items")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_rental_items()
    else:
        create_sample_rentals()
        list_rental_items()
