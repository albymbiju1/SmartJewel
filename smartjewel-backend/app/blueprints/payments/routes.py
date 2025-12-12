import os
import hmac
import hashlib
from uuid import uuid4
from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.blueprints.payments import bp
from app.extensions import db
from flask import current_app
from datetime import datetime
from app.services.whatsapp_service import get_whatsapp_service
try:
    from bson import ObjectId  # Mongo ObjectId for safe serialization
except Exception:
    ObjectId = type("ObjectId", (), {})  # fallback dummy


def _to_jsonable(obj):
    """Recursively convert MongoDB/BSON and datetime types to JSON-serializable forms."""
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(x) for x in obj]
    try:
        if isinstance(obj, ObjectId):
            return str(obj)
    except Exception:
        pass
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def _oid(val):
    """Convert string to ObjectId safely."""
    try:
        return ObjectId(val)
    except Exception:
        return None


def _now(db):
    """Get current timestamp."""
    return datetime.utcnow()

# ENV VARS expected (test keys)
# RAZORPAY_KEY_ID=rzp_test_xxx
# RAZORPAY_KEY_SECRET=xxxx


def inr_paise(amount_rupees: float) -> int:
    try:
        return max(0, int(round(float(amount_rupees) * 100)))
    except Exception:
        return 0


def _validate_and_update_stock(db, items, order_id, user_id=None):
    """Validate availability and decrement stock for purchased items.
    Creates stock movement records for audit trail.
    Returns (True, None) on success or (False, reason) on failure.
    """
    try:
        print(f"[STOCK UPDATE] Starting stock update for order {order_id}")
        print(f"[STOCK UPDATE] Items to process: {len(items or [])}")
        
        if not items:
            print("[STOCK UPDATE] No items to process")
            return True, None
        
        # Validate stock availability first
        for item in items or []:
            product_id = item.get("id")
            requested_quantity = item.get("qty", 0)
            print(f"[STOCK UPDATE] Validating item: id={product_id}, qty={requested_quantity}, name={item.get('name')}")
            
            if product_id and requested_quantity > 0:
                # Try multiple ways to find the product
                oid = _oid(product_id)
                print(f"[STOCK UPDATE] Converted ID to ObjectId: {oid}")
                product = db.items.find_one({"_id": oid})
                if not product:
                    print(f"[STOCK UPDATE] Not found by _id, trying sku...")
                    product = db.items.find_one({"sku": product_id})
                if not product:
                    print(f"[STOCK UPDATE] Not found by sku, trying as string _id...")
                    product = db.items.find_one({"_id": product_id})
                if not product:
                    print(f"[STOCK UPDATE] ERROR: Product {product_id} not found in database")
                    return False, f"Product {product_id} not found"
                current_quantity = product.get("quantity", 0)
                print(f"[STOCK UPDATE] Product found: {product.get('name')}, current stock: {current_quantity}")
                if current_quantity < requested_quantity:
                    print(f"[STOCK UPDATE] ERROR: Insufficient stock")
                    return False, f"Insufficient stock for {item.get('name', 'product')}. Available: {current_quantity}, Requested: {requested_quantity}"

        # Perform atomic decrements and record movements
        updated_count = 0
        for item in items or []:
            product_id = item.get("id")
            requested_quantity = item.get("qty", 0)
            if product_id and requested_quantity > 0:
                # Try multiple ways to find the product (same as validation)
                oid = _oid(product_id)
                product = db.items.find_one({"_id": oid})
                if not product:
                    product = db.items.find_one({"sku": product_id})
                if not product:
                    product = db.items.find_one({"_id": product_id})
                if product:
                    print(f"[STOCK UPDATE] Updating stock for {product.get('name')}: -{requested_quantity}")
                    result = db.items.update_one(
                        {"_id": product["_id"]},
                        {"$inc": {"quantity": -requested_quantity}, "$set": {"updated_at": _now(db)}}
                    )
                    if result.matched_count == 0:
                        print(f"[STOCK UPDATE] ERROR: Failed to update stock")
                        return False, f"Failed to update stock for {item.get('name', 'product')}"
                    
                    print(f"[STOCK UPDATE] Stock updated successfully, creating movement record")
                    db.stock_movements.insert_one({
                        "item_id": product["_id"],
                        "type": "outward",
                        "quantity": requested_quantity,
                        "from_location_id": None,
                        "to_location_id": None,
                        "ref": {"doc_type": "SALE", "order_id": order_id},
                        "note": f"Sold {requested_quantity} units",
                        "created_by": _oid(user_id) if user_id else None,
                        "created_at": _now(db)
                    })
                    updated_count += 1
        
        print(f"[STOCK UPDATE] Completed: {updated_count} items updated")
        return True, None
    except Exception as e:
        print(f"[STOCK UPDATE] EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, str(e)

@bp.post("/razorpay/order")
@jwt_required()
def create_razorpay_order():
    """
    Create a Razorpay order in test mode.
    Returns order_id and public key to initialize checkout on frontend.
    """
    data = request.get_json(silent=True) or {}
    amount = float(data.get("amount", 0))
    currency = (data.get("currency") or "INR").upper()
    if currency != "INR":
        currency = "INR"
    if amount <= 0:
        return jsonify({"error": "bad_amount"}), 400
    receipt = data.get("receipt") or f"sj_{uuid4().hex[:10]}"
    # If user is logged in, prefix receipt with user id to keep session unique per user
    try:
        uid = get_jwt_identity()
        if uid:
            receipt = f"u{str(uid)[-6:]}_{receipt}"
    except Exception:
        pass
    customer = data.get("customer") or {}
    # Ensure customer.userId is set if user is logged in
    try:
        uid = get_jwt_identity()
        if uid and not customer.get("userId"):
            customer["userId"] = uid
    except Exception:
        pass
    # Each item should include { id, name, qty, price, image }
    items = data.get("items") or []
    # Backfill image from product catalog when missing (ensures correct image is persisted with order)
    try:
        db_for_img = current_app.extensions.get('mongo_db')
        if db_for_img is not None and isinstance(items, list):
            enriched = []
            for it in items:
                if isinstance(it, dict) and (not it.get('image')):
                    prod = None
                    pid = it.get('id')
                    if pid:
                        from bson import ObjectId
                        try:
                            prod = db_for_img.items.find_one({"_id": ObjectId(pid)})
                        except Exception:
                            prod = db_for_img.items.find_one({"sku": pid})
                    if not prod and it.get('sku'):
                        prod = db_for_img.items.find_one({"sku": it.get('sku')})
                    if prod:
                        # Accept first available image field
                        img = prod.get('image') or prod.get('image_url') or prod.get('thumbnail')
                        if img:
                            it = {**it, 'image': img}
                enriched.append(it)
            items = enriched
    except Exception as _enrich_err:
        # Non-fatal; continue without enrichment
        pass

    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        return jsonify({"error": "razorpay_keys_missing"}), 500

    # Create order via Razorpay REST API (or mock base when configured)
    import requests
    try:
        api_base = os.getenv("RAZORPAY_API_BASE", "https://api.razorpay.com")
        payload = {
            "amount": inr_paise(amount),
            "currency": currency,
            "receipt": receipt,
            "notes": {
                "name": customer.get("name", ""),
                "email": customer.get("email", ""),
                "phone": customer.get("phone", ""),
                "address": customer.get("address", ""),
                "methods": "upi,card,netbanking,wallet",
                # Some mocks (e.g., Beeceptor) validate presence of specific keys
                "notes_key_1": customer.get("notes_key_1", receipt),
                "notes_key_2": customer.get("notes_key_2", "SmartJewel"),
            },
            "payment_capture": 1,
        }
        resp = requests.post(
            f"{api_base.rstrip('/')}/v1/orders",
            auth=(key_id, key_secret),
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 400:
            return jsonify({"error": "razorpay_order_failed", "details": resp.text}), 400
        order = resp.json()
    except Exception as e:
        return jsonify({"error": "razorpay_order_exception", "details": str(e)}), 500

    # Persist a minimal order doc for demo (optional) — use upsert to avoid duplicates
    db = current_app.extensions.get('mongo_db')
    if db is not None:
        try:
            db.orders.update_one(
                {"provider": "razorpay", "provider_order.id": order.get("id")},
                {"$set": {
                    "provider": "razorpay",
                    "provider_order": order,
                    "amount": amount,
                    "currency": currency,
                    "receipt": receipt,
                    "customer": customer,
                    "items": items,
                    "updated_at": _now(db),
                }, "$setOnInsert": {"status": "created", "created_at": _now(db)}},
                upsert=True
            )
            print(f"Order upserted to database: {receipt}")
        except Exception as e:
            print(f"Failed to save order to database: {e}")
    else:
        print("Database not available - order not persisted")

    return jsonify({
        "order": order,
        "key_id": key_id,
        "receipt": receipt,
    })

# Public alias to match requirement: /api/create-order
@bp.post("/api/create-order")
@jwt_required()
def api_create_order_alias():
    # Forward to same logic; keep payload shape identical
    return create_razorpay_order()


@bp.post("/razorpay/verify")
@jwt_required(optional=True)
def verify_razorpay_signature():
    """
    Verify Razorpay payment signature on success callback.
    """
    print("🔥 [PAYMENT VERIFY] Payment verification started!")
    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    # Get database from Flask app context
    db = current_app.extensions.get('mongo_db')

    # Allow skipping signature verification when using a mock API for local testing
    if os.getenv("RAZORPAY_SKIP_SIGNATURE", "false").lower() in ("1", "true", "yes"):
        # In test mode we still require auth so orders get linked to the user
        uid = get_jwt_identity()
        if not uid:
            return jsonify({"verified": False, "reason": "auth_required_for_order"}), 401

        order_doc = db.orders.find_one({"provider": "razorpay", "provider_order.id": order_id}) if db is not None else {}
        demo_order_id = order_doc.get("receipt") if order_doc else f"SJ-{(order_id or '')[-8:].upper()}"

        if db is not None:
            try:
                # Update provider order - mark as paid since payment was successful
                db.orders.update_one(
                    {"provider": "razorpay", "provider_order.id": order_id},
                    {"$set": {
                        "status": "paid",
                        "payment_status": "paid", 
                        "payment_id": payment_id,
                        "signature": signature,
                        "order_id": demo_order_id,
                        "user_id": _oid(uid) if uid else None,
                        "updated_at": _now(db)
                    }, "$push": {
                        "statusHistory": {"status": "paid", "timestamp": _now(db), "by": "system:razorpay", "notes": "Payment verified in test mode"}
                    }},
                )

                # Insert comprehensive order record (same shape as verified path) — upsert to avoid duplicates
                # Ensure each order item persists image field for accurate history
                def _ensure_item_images(itms):
                    out = []
                    try:
                        dbimg = current_app.extensions.get('mongo_db')
                        for it in (itms or []):
                            if isinstance(it, dict) and (not it.get('image')) and dbimg is not None:
                                prod = None
                                pid = it.get('id')
                                if pid:
                                    from bson import ObjectId
                                    try:
                                        prod = dbimg.items.find_one({"_id": ObjectId(pid)})
                                    except Exception:
                                        prod = dbimg.items.find_one({"sku": pid})
                                if not prod and it.get('sku'):
                                    prod = dbimg.items.find_one({"sku": it.get('sku')})
                                if prod:
                                    img = prod.get('image') or prod.get('image_url') or prod.get('thumbnail')
                                    if img:
                                        it = {**it, 'image': img}
                            out.append(it)
                    except Exception:
                        return itms or []
                    return out

                now_time = _now(db)
                # Ensure customer has userId
                customer_data = order_doc.get("customer", {}) or {}
                if uid and not customer_data.get("userId"):
                    customer_data["userId"] = uid
                order_record = {
                    "order_id": demo_order_id,
                    "user_id": _oid(uid) if uid else None,
                    "status": "paid",
                    "payment_status": "paid",
                    "delivery_status": "pending",
                    "payment_provider": "razorpay",
                    "payment_id": payment_id,
                    "razorpay_order_id": order_id,
                    "amount": order_doc.get("amount", 0),
                    "currency": order_doc.get("currency", "INR"),
                    "customer": customer_data,
                    "items": _ensure_item_images(order_doc.get("items", [])),
                    "statusHistory": [{"status": "created", "timestamp": now_time}, {"status": "paid", "timestamp": now_time, "by": "system:razorpay", "notes": "Payment verified"}],
                    "created_at": now_time,
                    "updated_at": now_time,
                    "notes": {"payment_method": "razorpay", "signature_verified": True}
                }
                db.orders.update_one(
                    {"$or": [{"payment_id": payment_id}, {"razorpay_order_id": order_id}]},
                    {"$setOnInsert": order_record, "$set": {"updatedAt": now_time}},  # Use different field name to avoid conflict
                    upsert=True
                )
                print(f"Test mode: order upserted for user {uid} with id {demo_order_id}")

                # Send WhatsApp order confirmation
                try:
                    whatsapp = get_whatsapp_service()
                    customer = order_record.get('customer', {})
                    name = customer.get('name', 'Customer')
                    phone = customer.get('phone', '')

                    if phone:
                        # Format items for WhatsApp
                        formatted_items = []
                        for item in order_record.get('items', []):
                            formatted_items.append({
                                'name': item.get('name', 'Item'),
                                'price': float(item.get('price', 0)),
                                'quantity': int(item.get('quantity', 1))
                            })

                        total = float(order_record.get('amount', 0))

                        if formatted_items:
                            wa_result = whatsapp.send_order_confirmation(
                                name=name,
                                phone=phone,
                                order_id=demo_order_id,
                                items=formatted_items,
                                total=total
                            )

                            if wa_result.get('success'):
                                print(f"✅ WhatsApp order confirmation sent to {phone} for order {demo_order_id}")
                            else:
                                print(f"⚠️ WhatsApp failed: {wa_result.get('message')}")
                        else:
                            print(f"⚠️ No items to send in WhatsApp for order {demo_order_id}")
                    else:
                        print(f"⚠️ No phone number for WhatsApp notification (order {demo_order_id})")
                except Exception as wa_error:
                    print(f"❌ WhatsApp error: {str(wa_error)}")

                # Decrement stock in test/skip-signature path as well
                ok_stock, reason = _validate_and_update_stock(db, order_record.get("items", []), demo_order_id, uid)
                if not ok_stock:
                    print(f"Stock update warning (test mode): {reason}")
            except Exception as e:
                print(f"Failed to persist test-mode order: {e}")
        return jsonify({"verified": True, "order_id": demo_order_id, "details": _to_jsonable(order_doc)})

    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_secret:
        return jsonify({"error": "razorpay_keys_missing"}), 500

    if not order_id or not payment_id or not signature:
        return jsonify({"error": "missing_fields"}), 400

    # Razorpay sometimes shares signature in hex; some SDKs provide base64.
    # We will verify against both representations to avoid false negatives in test mode.
    try:
        import base64
        body = f"{order_id}|{payment_id}".encode()
        mac = hmac.new(key_secret.encode(), body, hashlib.sha256)
        expected_hex = mac.hexdigest()
        expected_b64 = base64.b64encode(mac.digest()).decode()
        provided = (signature or "").strip()
        ok = hmac.compare_digest(expected_hex, provided.lower()) or hmac.compare_digest(expected_b64, provided)
    except Exception:
        ok = False

    # Update order status in DB for demo purposes
    if db is not None:
        try:
            update_data = {
                "status": "paid" if ok else "failed", 
                "payment_status": "paid" if ok else "failed",
                "payment_id": payment_id, 
                "signature": signature,
                "updated_at": _now(db)
            }
            push_data = {}
            if ok:
                push_data["statusHistory"] = {"status": "paid", "timestamp": _now(db), "by": "system:razorpay", "notes": "Payment verified"}
            
            update_query = {"$set": update_data}
            if push_data:
                update_query["$push"] = push_data
                
            db.orders.update_one(
                {"provider": "razorpay", "provider_order.id": order_id},
                update_query
            )
            print(f"Order status updated in database: {order_id} -> {'paid' if ok else 'failed'}")
        except Exception as e:
            print(f"Failed to update order status in database: {e}")
    else:
        print("Database not available - order status not updated")

    if not ok:
        return jsonify({"verified": False, "reason": "signature_mismatch"}), 400

    # Get order document first (created during order creation)
    order_doc = db.orders.find_one({"provider": "razorpay", "provider_order.id": order_id}) if db is not None else {}
    demo_order_id = order_doc.get("receipt") if order_doc else f"SJ-{order_id[-8:].upper()}"
    items = order_doc.get("items", [])
    
    print(f"[DEBUG] Order document found: {order_doc is not None and bool(order_doc)}")
    print(f"[DEBUG] Items from order: {items}")
    print(f"[DEBUG] Number of items: {len(items)}")

    # If payment is successful, create a proper order record
    if ok and db is not None:
        try:
            # Get user ID from JWT token
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({"verified": False, "reason": "auth_required_for_order"}), 401
            print(f"Creating order for user_id: {user_id}, order_id: {demo_order_id}")
            
            # Test database connection first
            try:
                test_result = db.orders.find_one()
                print(f"Database connection test successful: {test_result is not None}")
            except Exception as db_test_error:
                print(f"Database connection test failed: {db_test_error}")
                raise db_test_error
            
            # Create comprehensive order record
            # Ensure customer has userId
            customer_data = order_doc.get("customer", {}) or {}
            if user_id and not customer_data.get("userId"):
                customer_data["userId"] = user_id
            order_record = {
                "order_id": demo_order_id,
                "user_id": _oid(user_id) if user_id else None,
                "status": "paid",
                "payment_status": "paid",
                "delivery_status": "pending",
                "payment_provider": "razorpay",
                "payment_id": payment_id,
                "razorpay_order_id": order_id,
                "amount": order_doc.get("amount", 0),
                "currency": order_doc.get("currency", "INR"),
                "customer": customer_data,
                "items": order_doc.get("items", []),
                "statusHistory": [{"status": "created", "timestamp": _now(db)}, {"status": "paid", "timestamp": _now(db), "by": "system:razorpay", "notes": "Payment verified"}],
                "created_at": _now(db),
                "updated_at": _now(db),
                "notes": {
                    "payment_method": "razorpay",
                    "signature_verified": True
                }
            }
            
            print(f"Order record to insert: {order_record}")
            
            # Upsert the order record by payment_id/razorpay_order_id
            result = db.orders.update_one(
                {"$or": [{"payment_id": payment_id}, {"razorpay_order_id": order_id}]},
                {"$setOnInsert": order_record, "$set": {"updated_at": _now(db)}},
                upsert=True
            )
            print(f"Order upserted (matched: {result.matched_count}, upserted_id: {getattr(result, 'upserted_id', None)})")
            
            # Verify the order was actually inserted
            # Verify the order exists by either key
            inserted_order = db.orders.find_one({"$or": [{"payment_id": payment_id}, {"razorpay_order_id": order_id}]})
            print(f"Verification - order found: {inserted_order is not None}")
            
            # Update the existing razorpay order record with the new order_id
            update_result = db.orders.update_one(
                {"provider": "razorpay", "provider_order.id": order_id},
                {"$set": {"order_id": demo_order_id, "user_id": _oid(user_id) if user_id else None}}
            )
            print(f"Updated existing order: {update_result.modified_count} documents modified")
            
            # Send WhatsApp order confirmation
            try:
                whatsapp = get_whatsapp_service()
                customer = order_record.get('customer', {})
                name = customer.get('name', 'Customer')
                phone = customer.get('phone', '')

                if phone:
                    # Format items for WhatsApp
                    formatted_items = []
                    for item in order_record.get('items', []):
                        formatted_items.append({
                            'name': item.get('name', 'Item'),
                            'price': float(item.get('price', 0)),
                            'quantity': int(item.get('quantity', 1))
                        })

                    total = float(order_record.get('amount', 0))

                    if formatted_items:
                        wa_result = whatsapp.send_order_confirmation(
                            name=name,
                            phone=phone,
                            order_id=demo_order_id,
                            items=formatted_items,
                            total=total
                        )

                        if wa_result.get('success'):
                            print(f"✅ WhatsApp order confirmation sent to {phone} for order {demo_order_id}")
                        else:
                            print(f"⚠️ WhatsApp failed: {wa_result.get('message')}")
                    else:
                        print(f"⚠️ No items to send in WhatsApp for order {demo_order_id}")
                else:
                    print(f"⚠️ No phone number for WhatsApp notification (order {demo_order_id})")
            except Exception as wa_error:
                print(f"❌ WhatsApp error: {str(wa_error)}")

            # NOW update stock after order is confirmed
            print(f"[DEBUG] About to update stock")
            print(f"[DEBUG] Items for stock update: {items}")
            print(f"[DEBUG] Order ID: {demo_order_id}")
            print(f"[DEBUG] User ID: {user_id}")
            print(f"Updating stock for {len(items)} items")
            ok_stock, reason = _validate_and_update_stock(db, items, demo_order_id, user_id)
            if not ok_stock:
                print(f"Stock update failed: {reason}")
                # Log the error but don't fail the payment - order is already paid
                # Admin can manually adjust stock if needed
            else:
                print(f"Stock updated successfully for order {demo_order_id}")
            
        except Exception as e:
            print(f"Order creation error: {str(e)}")
            import traceback
            traceback.print_exc()
            # Don't fail the payment verification if order creation fails
    elif ok and db is None:
        print("Database not available - order not persisted to database")

    return jsonify({"verified": True, "order_id": demo_order_id, "details": _to_jsonable(order_doc)})


@bp.post("/test-stock-update")
@jwt_required()
def test_stock_update():
    """Test endpoint to manually trigger stock update"""
    try:
        db = current_app.extensions.get('mongo_db')
        if not db:
            return jsonify({"error": "db_unavailable"}), 503
        
        # Test with the order you showed me
        test_items = [
            {
                "id": "68bd7f94dd4c0084afd36eda",
                "name": "Geometric Pattern Diamond Pendant",
                "qty": 1,
                "price": 11966.16
            }
        ]
        
        print("[TEST] Testing stock update manually")
        ok_stock, reason = _validate_and_update_stock(db, test_items, "TEST-ORDER", get_jwt_identity())
        
        return jsonify({
            "success": ok_stock,
            "reason": reason,
            "message": "Stock update test completed"
        })
        
    except Exception as e:
        print(f"Test stock update error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@bp.post("/test-order-creation")
@jwt_required()
def test_order_creation():
    """Test endpoint to verify order creation works"""
    try:
        user_id = get_jwt_identity()
        test_order = {
            "order_id": f"TEST-{uuid4().hex[:8]}",
            "user_id": _oid(user_id) if user_id else None,
            "status": "test",
            "payment_status": "test",
            "delivery_status": "test",
            "amount": 100,
            "currency": "INR",
            "created_at": _now(db),
            "updated_at": _now(db)
        }
        
        result = db.orders.insert_one(test_order)
        return jsonify({"success": True, "inserted_id": str(result.inserted_id)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500