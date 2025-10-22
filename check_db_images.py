"""
Script to check image paths stored in MongoDB
Run this to see what images your database expects
"""
import os
from pymongo import MongoClient

# Get MongoDB URI from environment or use default
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

try:
    client = MongoClient(MONGODB_URI)
    db = client.get_database("smartjewel")
    
    print("=" * 60)
    print("Checking image paths in database...")
    print("=" * 60)
    
    # Check items collection
    items_with_images = list(db.items.find({"image": {"$exists": True, "$ne": None}}).limit(20))
    
    print(f"\nFound {len(items_with_images)} items with images (showing first 20):\n")
    
    for item in items_with_images:
        image_path = item.get("image", "")
        sku = item.get("sku", "N/A")
        name = item.get("name", "N/A")
        
        # Check if path is absolute or relative
        is_absolute = image_path.startswith("http://") or image_path.startswith("https://")
        has_leading_slash = image_path.startswith("/")
        
        status = "✅ OK" if has_leading_slash or is_absolute else "❌ MISSING SLASH"
        
        print(f"{status} | SKU: {sku:15} | {image_path}")
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    
    absolute_count = sum(1 for item in items_with_images if item.get("image", "").startswith("http"))
    relative_count = sum(1 for item in items_with_images if item.get("image", "").startswith("/"))
    malformed_count = len(items_with_images) - absolute_count - relative_count
    
    print(f"Absolute URLs (http/https):  {absolute_count}")
    print(f"Relative paths (starts /):   {relative_count}")
    print(f"Malformed (no leading /):    {malformed_count}")
    
    print("\n" + "=" * 60)
    print("Recommendations:")
    print("=" * 60)
    
    if absolute_count > 0:
        print("⚠️  You have absolute URLs - these might point to localhost!")
    
    if malformed_count > 0:
        print("⚠️  You have malformed paths - they need a leading slash!")
    
    if relative_count > 0:
        print("✅ Relative paths found - but files must exist on server!")
        print("   For Vercel, you MUST use cloud storage (Cloudinary, S3, etc.)")
    
    client.close()
    
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    print("\nMake sure:")
    print("1. MongoDB is running")
    print("2. MONGODB_URI environment variable is set correctly")
