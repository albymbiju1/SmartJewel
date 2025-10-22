"""
Migrate existing images to Cloudinary.

This script handles different scenarios:
1. Local relative paths (/static/uploads/...) - Upload files to Cloudinary
2. Absolute localhost URLs (http://127.0.0.1:5000/...) - Convert to relative or skip
3. Already on Cloudinary - Skip

Usage:
    python scripts/migrate_images_to_cloudinary.py [--dry-run] [--skip-missing]

Options:
    --dry-run: Show what would be migrated without making changes
    --skip-missing: Skip files that don't exist locally (don't fail)
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pymongo import MongoClient
from app.utils.cloudinary_helper import init_cloudinary, upload_image, is_cloudinary_configured
from dotenv import load_dotenv
import argparse

# Load environment variables
env_path = backend_dir / '.env'
if env_path.exists():
    load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")


def migrate_images(dry_run=False, skip_missing=False):
    """
    Migrate images from local storage to Cloudinary.
    """
    print("=" * 70)
    print("SmartJewel Image Migration to Cloudinary")
    print("=" * 70)
    print()
    
    # Check Cloudinary configuration
    if not is_cloudinary_configured():
        print("❌ ERROR: Cloudinary is not configured!")
        print()
        print("Please set the following environment variables:")
        print("  - CLOUDINARY_CLOUD_NAME")
        print("  - CLOUDINARY_API_KEY")
        print("  - CLOUDINARY_API_SECRET")
        print()
        return False
    
    # Initialize Cloudinary
    if not dry_run:
        init_cloudinary()
        print("✅ Cloudinary initialized")
    else:
        print("🔍 DRY RUN MODE - No changes will be made")
    
    print()
    
    # Connect to MongoDB
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_database("smartjewel")
        print(f"✅ Connected to MongoDB")
        print()
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return False
    
    # Find all items with images
    items_with_images = list(db.items.find({"image": {"$exists": True, "$ne": None}}))
    
    if not items_with_images:
        print("ℹ️  No items with images found in database")
        print()
        return True
    
    print(f"Found {len(items_with_images)} items with images")
    print()
    
    # Categorize images
    cloudinary_images = []
    local_relative = []
    local_absolute = []
    malformed = []
    
    for item in items_with_images:
        image_path = item.get("image", "")
        
        if image_path.startswith("https://res.cloudinary.com"):
            cloudinary_images.append(item)
        elif image_path.startswith("/static/uploads/"):
            local_relative.append(item)
        elif "127.0.0.1" in image_path or "localhost" in image_path:
            local_absolute.append(item)
        else:
            malformed.append(item)
    
    # Print summary
    print("📊 Image Status Summary:")
    print(f"  ✅ Already on Cloudinary: {len(cloudinary_images)}")
    print(f"  📁 Local relative paths:  {len(local_relative)}")
    print(f"  🔗 Absolute localhost URLs: {len(local_absolute)}")
    print(f"  ⚠️  Malformed paths:      {len(malformed)}")
    print()
    
    # Migration counters
    migrated = 0
    skipped = 0
    failed = 0
    
    # Process local relative paths
    if local_relative:
        print("🔄 Migrating local relative paths to Cloudinary...")
        print()
        
        for item in local_relative:
            sku = item.get("sku", "unknown")
            image_path = item.get("image")
            
            # Construct full file path
            file_path = backend_dir / image_path.lstrip("/")
            
            print(f"  Processing: {sku}")
            print(f"    Current:  {image_path}")
            
            if not file_path.exists():
                print(f"    ❌ File not found: {file_path}")
                if skip_missing:
                    print(f"    ⏭️  Skipping...")
                    skipped += 1
                else:
                    print(f"    💥 FAILED - File missing")
                    failed += 1
                print()
                continue
            
            if dry_run:
                print(f"    🔍 Would upload to: smartjewel/products/product_{sku}")
                print(f"    ✓ DRY RUN - No changes made")
                migrated += 1
            else:
                try:
                    # Upload to Cloudinary
                    with open(file_path, 'rb') as f:
                        result = upload_image(
                            f,
                            folder="smartjewel/products",
                            public_id=f"product_{sku}"
                        )
                    
                    # Update database
                    db.items.update_one(
                        {"_id": item["_id"]},
                        {"$set": {"image": result['secure_url']}}
                    )
                    
                    print(f"    ✅ Uploaded: {result['secure_url']}")
                    migrated += 1
                    
                except Exception as e:
                    print(f"    ❌ FAILED: {str(e)}")
                    failed += 1
            
            print()
    
    # Handle absolute localhost URLs
    if local_absolute:
        print("🔗 Processing absolute localhost URLs...")
        print()
        
        for item in local_absolute:
            sku = item.get("sku", "unknown")
            image_path = item.get("image")
            
            print(f"  Processing: {sku}")
            print(f"    Current:  {image_path}")
            
            # Try to extract relative path
            if "/static/uploads/" in image_path:
                relative_path = "/" + image_path.split("/static/uploads/")[1]
                relative_path = "/static/uploads/" + relative_path.split("/static/uploads/")[-1]
                
                file_path = backend_dir / relative_path.lstrip("/")
                
                if file_path.exists():
                    if dry_run:
                        print(f"    🔍 Would upload to: smartjewel/products/product_{sku}")
                        print(f"    ✓ DRY RUN - No changes made")
                        migrated += 1
                    else:
                        try:
                            with open(file_path, 'rb') as f:
                                result = upload_image(
                                    f,
                                    folder="smartjewel/products",
                                    public_id=f"product_{sku}"
                                )
                            
                            db.items.update_one(
                                {"_id": item["_id"]},
                                {"$set": {"image": result['secure_url']}}
                            )
                            
                            print(f"    ✅ Uploaded: {result['secure_url']}")
                            migrated += 1
                        except Exception as e:
                            print(f"    ❌ FAILED: {str(e)}")
                            failed += 1
                else:
                    print(f"    ❌ File not found locally")
                    if skip_missing:
                        print(f"    ⏭️  Skipping...")
                        skipped += 1
                    else:
                        failed += 1
            else:
                print(f"    ⚠️  Cannot extract file path from URL")
                skipped += 1
            
            print()
    
    # Report malformed paths
    if malformed:
        print("⚠️  Malformed image paths found:")
        print()
        for item in malformed:
            print(f"  SKU: {item.get('sku', 'unknown')}")
            print(f"    Path: {item.get('image')}")
            print(f"    ⚠️  Please fix manually")
            print()
        skipped += len(malformed)
    
    # Final summary
    print("=" * 70)
    print("Migration Summary")
    print("=" * 70)
    print(f"  ✅ Successfully migrated: {migrated}")
    print(f"  ⏭️  Skipped:              {skipped}")
    print(f"  ❌ Failed:               {failed}")
    print(f"  📁 Already on Cloudinary: {len(cloudinary_images)}")
    print()
    
    if dry_run:
        print("🔍 This was a DRY RUN - no changes were made")
        print("   Run without --dry-run to perform actual migration")
    else:
        if migrated > 0:
            print("✅ Migration completed successfully!")
        if failed > 0:
            print("⚠️  Some migrations failed - check logs above")
    
    print()
    
    client.close()
    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Migrate images to Cloudinary")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without making changes")
    parser.add_argument("--skip-missing", action="store_true", help="Skip files that don't exist locally")
    
    args = parser.parse_args()
    
    success = migrate_images(dry_run=args.dry_run, skip_missing=args.skip_missing)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
