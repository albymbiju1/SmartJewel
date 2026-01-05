"""
Setup script for Rental Booking System Collections
Creates necessary collections, indexes, and extends existing rental_items
Run this script once to initialize the database for the booking system
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "smartjewel"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

print("🚀 Setting up Rental Booking System Collections...")
print(f"📊 Database: {DB_NAME}\n")

# ===== 1. CREATE COLLECTIONS =====

print("1️⃣  Creating Collections...")

# rental_bookings collection
if "rental_bookings" not in db.list_collection_names():
    db.create_collection("rental_bookings")
    print("   ✅ Created 'rental_bookings' collection")
else:
    print("   ℹ️  'rental_bookings' collection already exists")

# rental_payments collection
if "rental_payments" not in db.list_collection_names():
    db.create_collection("rental_payments")
    print("   ✅ Created 'rental_payments' collection")
else:
    print("   ℹ️  'rental_payments' collection already exists")

print()

# ===== 2. CREATE INDEXES =====

print("2️⃣  Creating Indexes for Performance...")

# Indexes for rental_bookings
booking_indexes = [
    # Query bookings by rental item and dates (for availability checks)
    ([("rental_item_id", ASCENDING), ("start_date", ASCENDING), ("end_date", ASCENDING)], {"name": "idx_item_dates"}),
    
    # Query customer's bookings
    ([("customer_id", ASCENDING), ("created_at", DESCENDING)], {"name": "idx_customer_bookings"}),
    
    # Query by booking status
    ([("booking_status", ASCENDING), ("start_date", ASCENDING)], {"name": "idx_status_date"}),
    
    # Query by date range (for calendar views)
    ([("start_date", ASCENDING), ("end_date", ASCENDING)], {"name": "idx_date_range"}),
    
    # Query by payment status
    ([("payment_status", ASCENDING)], {"name": "idx_payment_status"}),
]

for index_keys, index_options in booking_indexes:
    try:
        db.rental_bookings.create_index(index_keys, **index_options)
        print(f"   ✅ Created index: {index_options['name']}")
    except Exception as e:
        print(f"   ⚠️  Index {index_options['name']} already exists or error: {e}")

# Indexes for rental_payments
payment_indexes = [
    # Query payments by booking
    ([("booking_id", ASCENDING), ("created_at", DESCENDING)], {"name": "idx_booking_payments"}),
    
    # Query payments by customer
    ([("customer_id", ASCENDING), ("payment_date", DESCENDING)], {"name": "idx_customer_payments"}),
]

for index_keys, index_options in payment_indexes:
    try:
        db.rental_payments.create_index(index_keys, **index_options)
        print(f"   ✅ Created index: {index_options['name']}")
    except Exception as e:
        print(f"   ⚠️  Index {index_options['name']} already exists or error: {e}")

print()

# ===== 3. EXTEND RENTAL_ITEMS COLLECTION =====

print("3️⃣  Extending rental_items with booking fields...")

# Add new fields to existing rental_items
update_result = db.rental_items.update_many(
    {},  # All documents
    {
        "$set": {
            "min_rental_days": 1,
            "max_rental_days": 30,
            "advance_booking_days": 90,
            "is_available_for_booking": True
        }
    }
)

if update_result.modified_count > 0:
    print(f"   ✅ Updated {update_result.modified_count} rental items with booking fields")
elif update_result.matched_count > 0:
    print(f"   ℹ️  {update_result.matched_count} rental items already have booking fields")
else:
    print("   ℹ️  No rental items found to update")

print()

# ===== 4. CREATE SAMPLE BOOKING (Optional) =====

print("4️⃣  Creating Sample Data (Optional)...")

# Check if there are any rental items
rental_items = list(db.rental_items.find().limit(1))
customers = list(db.users.find({"role.role_name": "Customer"}).limit(1))

if rental_items and customers:
    sample_rental = rental_items[0]
    sample_customer = customers[0]
    
    # Check if sample booking already exists
    existing_booking = db.rental_bookings.find_one({"notes": "Sample booking created by setup script"})
    
    if not existing_booking:
        sample_booking = {
            "rental_item_id": sample_rental["_id"],
            "product_id": sample_rental["product_id"],
            "customer_id": sample_customer["_id"],
            
            # Booking dates (7 days from now to 14 days from now)
            "start_date": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
            "end_date": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
            "duration_days": 7,
            
            # Pricing
            "rental_price_per_day": sample_rental.get("rental_price_per_day", 1000),
            "total_rental_price": sample_rental.get("rental_price_per_day", 1000) * 7,
            "security_deposit": sample_rental.get("security_deposit", 50000),
            "late_fee": 0,
            "total_amount": (sample_rental.get("rental_price_per_day", 1000) * 7) + sample_rental.get("security_deposit", 50000),
            
            # Payment
            "payment_status": "pending",
            "amount_paid": 0,
            "deposit_refunded": False,
            
            # Status
            "booking_status": "confirmed",
            
            # Handover (null initially)
            "actual_pickup_date": None,
            "actual_return_date": None,
            "pickup_staff_id": None,
            "return_staff_id": None,
            
            # Condition
            "condition_at_pickup": None,
            "condition_at_return": None,
            "damage_notes": None,
            "damage_charge": 0,
            
            # Metadata
            "notes": "Sample booking created by setup script",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": sample_customer["_id"],
            "cancelled_at": None,
            "cancelled_by": None,
            "cancellation_reason": None
        }
        
        result = db.rental_bookings.insert_one(sample_booking)
        print(f"   ✅ Created sample booking: {result.inserted_id}")
    else:
        print("   ℹ️  Sample booking already exists")
else:
    print("   ⚠️  No rental items or customers found - skipping sample data creation")

print()

# ===== SUMMARY =====

print("=" * 60)
print("✅ SETUP COMPLETE!")
print("=" * 60)
print(f"📊 Collections created: rental_bookings, rental_payments")
print(f"📇 Indexes created for optimal query performance")
print(f"🔧 Extended rental_items with booking fields")
print(f"🗄️  Database: {DB_NAME}")
print()
print("🎉 Rental Booking System is ready to use!")
print("=" * 60)

client.close()
