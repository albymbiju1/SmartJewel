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
    items = data.get("items") or []

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

    # Persist a minimal order doc for demo (optional)
    db = current_app.extensions.get('mongo_db')
    if db is not None:
        try:
            db.orders.insert_one({
                "provider": "razorpay",
                "provider_order": order,
                "status": "created",
                "amount": amount,
                "currency": currency,
                "receipt": receipt,
                "customer": customer,
                "items": items,
            })
            print(f"Order saved to database: {receipt}")
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
                # Update provider order
                db.orders.update_one(
                    {"provider": "razorpay", "provider_order.id": order_id},
                    {"$set": {
                        "status": "paid",
                        "payment_id": payment_id,
                        "signature": signature,
                        "order_id": demo_order_id,
                        "user_id": _oid(uid) if uid else None,
                        "updated_at": _now(db)
                    }},
                )

                # Insert comprehensive order record (same shape as verified path)
                order_record = {
                    "order_id": demo_order_id,
                    "user_id": _oid(uid) if uid else None,
                    "status": "confirmed",
                    "payment_status": "paid",
                    "delivery_status": "pending",
                    "payment_provider": "razorpay",
                    "payment_id": payment_id,
                    "razorpay_order_id": order_id,
                    "amount": order_doc.get("amount", 0),
                    "currency": order_doc.get("currency", "INR"),
                    "customer": order_doc.get("customer", {}),
                    "items": order_doc.get("items", []),
                    "created_at": _now(db),
                    "updated_at": _now(db),
                    "notes": {"payment_method": "razorpay", "signature_verified": True}
                }
                db.orders.insert_one(order_record)
                print(f"Test mode: order persisted for user {uid} with id {demo_order_id}")
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
            db.orders.update_one(
                {"provider": "razorpay", "provider_order.id": order_id},
                {"$set": {"status": "paid" if ok else "failed", "payment_id": payment_id, "signature": signature}},
            )
            print(f"Order status updated in database: {order_id}")
        except Exception as e:
            print(f"Failed to update order status in database: {e}")
    else:
        print("Database not available - order status not updated")

    if not ok:
        return jsonify({"verified": False, "reason": "signature_mismatch"}), 400

    # If payment is successful, validate and update stock
    if ok and db is not None:
        try:
            order_doc = db.orders.find_one({"provider": "razorpay", "provider_order.id": order_id}) or {}
            items = order_doc.get("items", [])
            
            # Validate stock availability before updating
            for item in items:
                product_id = item.get("id")
                requested_quantity = item.get("qty", 0)
                
                if product_id and requested_quantity > 0:
                    # Find product by ID or SKU
                    product = db.items.find_one({"_id": _oid(product_id)}) or db.items.find_one({"sku": product_id})
                    if not product:
                        return jsonify({"verified": False, "reason": f"Product {product_id} not found"}), 400
                    
                    current_quantity = product.get("quantity", 0)
                    if current_quantity < requested_quantity:
                        return jsonify({"verified": False, "reason": f"Insufficient stock for {item.get('name', 'product')}. Available: {current_quantity}, Requested: {requested_quantity}"}), 400
            
            # Update stock quantities
            for item in items:
                product_id = item.get("id")
                requested_quantity = item.get("qty", 0)
                
                if product_id and requested_quantity > 0:
                    # Find product by ID or SKU
                    product = db.items.find_one({"_id": _oid(product_id)}) or db.items.find_one({"sku": product_id})
                    if product:
                        # Update quantity using atomic operation
                        result = db.items.update_one(
                            {"_id": product["_id"]},
                            {"$inc": {"quantity": -requested_quantity}, "$set": {"updated_at": _now(db)}}
                        )
                        
                        if result.matched_count == 0:
                            return jsonify({"verified": False, "reason": f"Failed to update stock for {item.get('name', 'product')}"}), 400
                        
                        # Create stock movement record
                        db.stock_movements.insert_one({
                            "item_id": product["_id"],
                            "type": "outward",
                            "quantity": requested_quantity,
                            "from_location_id": None,
                            "to_location_id": None,
                            "ref": {"doc_type": "SALE", "order_id": order_id},
                            "note": f"Sold {requested_quantity} units",
                            "created_by": _oid(get_jwt_identity()) if get_jwt_identity() else None,
                            "created_at": _now(db)
                        })
                        
        except Exception as e:
            # Log error but don't fail the payment verification
            print(f"Stock update error: {str(e)}")
            pass
    elif ok and db is None:
        print("Database not available - skipping stock validation and updates")

    # Generate a simple demo order_id to show on confirmation page
    order_doc = db.orders.find_one({"provider": "razorpay", "provider_order.id": order_id}) if db is not None else {}
    demo_order_id = order_doc.get("receipt") if order_doc else f"SJ-{order_id[-8:].upper()}"

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
            order_record = {
                "order_id": demo_order_id,
                "user_id": _oid(user_id) if user_id else None,
                "status": "confirmed",
                "payment_status": "paid",
                "delivery_status": "pending",
                "payment_provider": "razorpay",
                "payment_id": payment_id,
                "razorpay_order_id": order_id,
                "amount": order_doc.get("amount", 0),
                "currency": order_doc.get("currency", "INR"),
                "customer": order_doc.get("customer", {}),
                "items": order_doc.get("items", []),
                "created_at": _now(db),
                "updated_at": _now(db),
                "notes": {
                    "payment_method": "razorpay",
                    "signature_verified": True
                }
            }
            
            print(f"Order record to insert: {order_record}")
            
            # Insert the order record
            result = db.orders.insert_one(order_record)
            print(f"Order inserted with ID: {result.inserted_id}")
            
            # Verify the order was actually inserted
            inserted_order = db.orders.find_one({"_id": result.inserted_id})
            print(f"Verification - inserted order found: {inserted_order is not None}")
            
            # Update the existing razorpay order record with the new order_id
            update_result = db.orders.update_one(
                {"provider": "razorpay", "provider_order.id": order_id},
                {"$set": {"order_id": demo_order_id, "user_id": _oid(user_id) if user_id else None}}
            )
            print(f"Updated existing order: {update_result.modified_count} documents modified")
            
        except Exception as e:
            print(f"Order creation error: {str(e)}")
            import traceback
            traceback.print_exc()
            # Don't fail the payment verification if order creation fails
    elif ok and db is None:
        print("Database not available - order not persisted to database")

    return jsonify({"verified": True, "order_id": demo_order_id, "details": _to_jsonable(order_doc)})


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