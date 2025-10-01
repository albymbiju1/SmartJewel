import os
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict

from dotenv import load_dotenv
try:
    # Python 3.9+
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    # Fallback to UTC if zoneinfo not available
    IST = timezone.utc
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from bson.objectid import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")

STATUS_DEFAULT = "Created"


def to_decimal(n: Any) -> Decimal:
    try:
        if n is None:
            return Decimal("0")
        if isinstance(n, (int, float)):
            return Decimal(str(n))
        if isinstance(n, Decimal):
            return n
        # strings etc.
        return Decimal(str(n))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def compute_total(order: Dict[str, Any]) -> Decimal:
    items = order.get("items") or []
    total_items = Decimal("0")
    for it in items:
        price = to_decimal(it.get("price"))
        qty = to_decimal(it.get("qty", 1))
        total_items += price * qty
    making = to_decimal(order.get("makingCharges"))
    taxes = to_decimal(order.get("taxes"))
    return total_items + making + taxes


def backfill_orders():
    client = MongoClient(MONGODB_URI)
    db = client[MONGO_DB_NAME]
    orders = db["orders"]

    print(f"Connected to DB '{MONGO_DB_NAME}' at '{MONGODB_URI}'")

    updated_count = 0
    inspected = 0

    cursor = orders.find({}, no_cursor_timeout=True)
    try:
        for doc in cursor:
            inspected += 1
            updates = {}

            # createdAt / updatedAt from _id timestamp if missing (store in IST)
            created_at_val = doc.get("createdAt")
            if not created_at_val:
                oid: ObjectId = doc.get("_id")
                if isinstance(oid, ObjectId):
                    created_at_val = oid.generation_time.astimezone(IST)
                else:
                    created_at_val = datetime.now(IST)
                updates.setdefault("$set", {})["createdAt"] = created_at_val
            else:
                # ensure timezone awareness in IST
                if isinstance(created_at_val, datetime) and created_at_val.tzinfo is None:
                    created_at_val = created_at_val.replace(tzinfo=IST)
            if not doc.get("updatedAt"):
                # default to createdAt or _id time if missing
                base_dt = created_at_val or (doc.get("_id").generation_time.astimezone(IST) if isinstance(doc.get("_id"), ObjectId) else datetime.now(IST))
                updates.setdefault("$set", {})["updatedAt"] = base_dt

            # default status
            status_val = doc.get("status") or STATUS_DEFAULT
            if not doc.get("status"):
                updates.setdefault("$set", {})["status"] = status_val

            # ensure statusHistory exists and contains initial entry in IST timezone
            if doc.get("statusHistory") is None or len(doc.get("statusHistory") or []) == 0:
                updates.setdefault("$set", {})["statusHistory"] = [
                    {
                        "status": (status_val or "created").lower(),
                        "timestamp": created_at_val or datetime.now(IST),
                        "notes": "initialized by migration",
                    }
                ]

            # ensure shipping exists as structured object if missing or invalid
            shipping_doc = doc.get("shipping") if isinstance(doc.get("shipping"), dict) else {}
            shipping_struct = {
                "address": shipping_doc.get("address") or (doc.get("customer", {}).get("address")),
                "method": shipping_doc.get("method") or "Standard Delivery",
                "trackingId": shipping_doc.get("trackingId"),
                "status": shipping_doc.get("status") or "pending",
            }
            updates.setdefault("$set", {})["shipping"] = shipping_struct

            # ensure makingCharges and taxes fields exist (optional defaults)
            if "makingCharges" not in doc:
                updates.setdefault("$set", {})["makingCharges"] = None
            if "taxes" not in doc:
                updates.setdefault("$set", {})["taxes"] = None

            # compute totalAmount if missing
            if doc.get("totalAmount") is None:
                total = compute_total({**doc, **updates.get("$set", {})})
                updates.setdefault("$set", {})["totalAmount"] = float(total)

            # touch updatedAt when we change anything (IST)
            if updates:
                updates.setdefault("$set", {})["updatedAt"] = datetime.now(IST)
                orders.update_one({"_id": doc["_id"]}, updates)
                updated_count += 1
                if updated_count % 100 == 0:
                    print(f"Updated {updated_count} orders...")
    finally:
        cursor.close()

    print(f"Inspected {inspected} orders. Updated {updated_count} orders.")

    # Create indexes
    print("\nCreating indexes (idempotent)...")
    orders.create_index([("customer.email", ASCENDING)], name="idx_customer_email")
    orders.create_index([("customer.phone", ASCENDING)], name="idx_customer_phone")
    orders.create_index([("provider_order.receipt", ASCENDING)], name="idx_provider_order_receipt")
    orders.create_index([("status", ASCENDING)], name="idx_status")
    orders.create_index([("createdAt", DESCENDING)], name="idx_createdAt_desc")
    orders.create_index([("customer.userId", ASCENDING)], name="idx_customer_userId")
    orders.create_index([("statusHistory.status", ASCENDING)], name="idx_statusHistory_status")
    # text index on items.name
    # Note: Text index must be the only text index in a collection (MongoDB rule)
    try:
        orders.create_index([("items.name", TEXT)], name="text_items_name")
    except Exception as e:
        print(f"Warning: could not create text index on items.name: {e}")

    # Show a sample updated document
    sample = orders.find_one({}, sort=[("updatedAt", DESCENDING)])
    print("\nSample updated order document:")
    if sample:
        # Shallow projection for readability
        printable = {
            "_id": str(sample.get("_id")),
            "status": sample.get("status"),
            "createdAt": sample.get("createdAt"),
            "updatedAt": sample.get("updatedAt"),
            "totalAmount": sample.get("totalAmount"),
            "makingCharges": sample.get("makingCharges"),
            "taxes": sample.get("taxes"),
            "shipping": sample.get("shipping"),
            "customer": {
                "name": sample.get("customer", {}).get("name"),
                "email": sample.get("customer", {}).get("email"),
                "phone": sample.get("customer", {}).get("phone"),
            },
            "items_count": len(sample.get("items", []) or []),
        }
        print(printable)
    else:
        print("No orders found.")

    # List all indexes
    print("\nCurrent indexes on 'orders':")
    for idx in orders.list_indexes():
        print(idx)


if __name__ == "__main__":
    backfill_orders()
