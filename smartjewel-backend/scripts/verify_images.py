"""
Verify that all image paths in the database correspond to actual files
"""
import os
from pymongo import MongoClient

def verify_images():
    client = MongoClient('mongodb://localhost:27017')
    db = client['smartjewel_dev']
    
    # Get the uploads directory path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    uploads_dir = os.path.join(backend_dir, 'app', 'static', 'uploads')
    
    print(f"Checking uploads directory: {uploads_dir}")
    print(f"Directory exists: {os.path.exists(uploads_dir)}\n")
    
    # List all files in uploads directory
    if os.path.exists(uploads_dir):
        files_on_disk = set(os.listdir(uploads_dir))
        print(f"Files on disk ({len(files_on_disk)}):")
        for f in sorted(files_on_disk):
            print(f"  - {f}")
    else:
        files_on_disk = set()
        print("No uploads directory found!")
    
    print("\n" + "="*60 + "\n")
    
    # Check all items in database
    items = list(db.items.find())
    print(f"Items in database: {len(items)}\n")
    
    missing_files = []
    valid_files = []
    
    for item in items:
        sku = item.get('sku', 'N/A')
        image_path = item.get('image', '')
        
        if not image_path:
            print(f"❌ SKU {sku}: No image path")
            continue
            
        # Extract filename from path
        filename = os.path.basename(image_path)
        
        if filename in files_on_disk:
            print(f"✅ SKU {sku}: {image_path}")
            valid_files.append((sku, image_path))
        else:
            print(f"❌ SKU {sku}: {image_path} - FILE NOT FOUND!")
            missing_files.append((sku, image_path, filename))
    
    print("\n" + "="*60)
    print(f"\nSummary:")
    print(f"  Valid images: {len(valid_files)}")
    print(f"  Missing files: {len(missing_files)}")
    
    if missing_files:
        print(f"\nMissing files details:")
        for sku, path, filename in missing_files:
            print(f"  SKU {sku}: Expected {filename}")

if __name__ == '__main__':
    verify_images()
