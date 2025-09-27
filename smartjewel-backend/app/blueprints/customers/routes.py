from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.authz import require_roles, require_permissions
from app.utils.security import verify_password, hash_password
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import pytz

log = logging.getLogger(__name__)
bp = Blueprint("customers", __name__, url_prefix="/customers")

def _oid(id_str):
    """Convert string to ObjectId, return None if invalid"""
    try:
        return ObjectId(id_str) if id_str else None
    except:
        return None

def _now(db):
    """Get current timestamp"""
    try:
        return db.command("isMaster")['localTime']
    except:
        return datetime.utcnow()

IST_TZ = pytz.timezone("Asia/Kolkata")

def _to_ist(dt: datetime):
    try:
        if not isinstance(dt, datetime):
            return None
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(IST_TZ)
    except Exception:
        return None

@bp.get("/")
@jwt_required()
@require_permissions("*")
def list_customers():
    """List all customers with pagination and search"""
    db = current_app.extensions['mongo_db']
    
    # Pagination parameters
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    search = request.args.get('search', '').strip()
    
    # Build query for customers only
    query = {"role.role_name": "Customer", "status": "active"}
    
    # Add search functionality
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone_number": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = db.users.count_documents(query)
    
    # Get customers with pagination
    skip = (page - 1) * limit
    customers = list(db.users.find(query).skip(skip).limit(limit).sort("created_at", -1))
    
    # Format customer data
    customer_list = []
    for customer in customers:
        customer_list.append({
            "id": str(customer["_id"]),
            "full_name": customer.get("full_name", ""),
            "email": customer.get("email", ""),
            "phone_number": customer.get("phone_number", ""),
            "status": customer.get("status", "active"),
            "created_at": customer.get("created_at"),
            "last_login": customer.get("last_login"),
            "firebase_uid": customer.get("firebase_uid")
        })
    
    return jsonify({
        "customers": customer_list,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    })

@bp.get("/<customer_id>")
@jwt_required()
@require_permissions("*")
def get_customer(customer_id):
    """Get detailed customer information including purchase history"""
    db = current_app.extensions['mongo_db']
    
    customer_oid = _oid(customer_id)
    if not customer_oid:
        return jsonify({"error": "invalid_customer_id"}), 400
    
    # Get customer details
    customer = db.users.find_one({"_id": customer_oid, "role.role_name": "Customer"})
    if not customer:
        return jsonify({"error": "customer_not_found"}), 404

    # Build purchase history from orders collection
    orders_cursor = db.orders.find({
        "user_id": customer_oid
    }).sort("created_at", -1)

    purchase_history = []
    total_orders = 0
    total_spent = 0.0
    last_order_date = None

    for order in orders_cursor:
        total_orders += 1
        amount = float(order.get("amount", 0) or 0)
        total_spent += amount
        created_at = order.get("created_at")
        created_at_ist = _to_ist(created_at)
        if created_at and (last_order_date is None or created_at > last_order_date):
            last_order_date = created_at

        # Normalize items for admin table
        items = []
        for it in order.get("items", []) or []:
            try:
                items.append({
                    "name": it.get("name") or it.get("title") or it.get("sku") or "Item",
                    "quantity": it.get("qty") or it.get("quantity") or 1,
                    "price": float(it.get("price") or 0),
                })
            except Exception:
                pass

        purchase_history.append({
            "order_id": order.get("order_id") or str(order.get("_id")),
            "date": created_at_ist.isoformat() if created_at_ist else (created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at),
            "createdAt_ist": created_at_ist.isoformat() if created_at_ist else None,
            "items": items,
            "items_count": sum(int(i.get("quantity", 0) or 0) for i in items) or len(items),
            "total_amount": amount,
            "status": order.get("status") or order.get("payment_status") or "unknown",
        })

    customer_data = {
        "id": str(customer["_id"]),
        "full_name": customer.get("full_name", ""),
        "email": customer.get("email", ""),
        "phone_number": customer.get("phone_number", ""),
        "status": customer.get("status", "active"),
        "created_at": customer.get("created_at"),
        "last_login": customer.get("last_login"),
        "firebase_uid": customer.get("firebase_uid"),
        "statistics": {
            "total_orders": total_orders,
            "total_spent": round(total_spent, 2),
            "avg_order_value": round((total_spent / total_orders) if total_orders else 0.0, 2),
            "last_order_date": (_to_ist(last_order_date).isoformat() if _to_ist(last_order_date) else (last_order_date.isoformat() if hasattr(last_order_date, 'isoformat') else last_order_date))
        },
        "purchase_history": purchase_history
    }
    
    return jsonify(customer_data)

@bp.get("/<customer_id>/orders")
@jwt_required()
@require_permissions("*")
def get_customer_orders(customer_id):
    """Get detailed order history for a specific customer"""
    db = current_app.extensions['mongo_db']
    
    customer_oid = _oid(customer_id)
    if not customer_oid:
        return jsonify({"error": "invalid_customer_id"}), 400
    
    # Verify customer exists
    customer = db.users.find_one({"_id": customer_oid, "role.role_name": "Customer"})
    if not customer:
        return jsonify({"error": "customer_not_found"}), 404
    
    # Get orders for this customer, sorted by creation date (newest first)
    orders_cursor = db.orders.find(
        {"user_id": customer_oid},
        {"provider": 0, "provider_order": 0, "razorpay_order_id": 0, "payment_id": 0, "signature": 0}
    ).sort("created_at", -1)
    
    orders = []
    for order in orders_cursor:
        # Convert ObjectId to string for JSON serialization
        order["_id"] = str(order["_id"])
        if order.get("user_id"):
            order["user_id"] = str(order["user_id"])
        # Add IST converted fields
        created_at = order.get("created_at")
        created_at_ist = _to_ist(created_at)
        if created_at_ist:
            order["createdAt_ist"] = created_at_ist.isoformat()
        orders.append(order)
    
    return jsonify({"orders": orders})

@bp.get("/me/orders")
@jwt_required()
def get_my_orders():
    """Get orders for the currently authenticated user"""
    from datetime import datetime

    db = current_app.extensions.get('mongo_db')
    user_id = get_jwt_identity()

    if not user_id:
        return jsonify({"error": "authentication_required"}), 401

    # PyMongo Database objects don't support truthiness; compare explicitly to None
    if db is None:
        return jsonify({"orders": [], "message": "Database not available"}), 503

    # Get orders for current user, sorted by creation date (newest first)
    orders_cursor = db.orders.find(
        {"user_id": _oid(user_id)},
        {"provider": 0, "provider_order": 0, "razorpay_order_id": 0, "payment_id": 0, "signature": 0}
    ).sort("created_at", -1)

    orders = []
    for order in orders_cursor:
        # Convert ObjectId to string for JSON serialization
        order["_id"] = str(order["_id"])
        if order.get("user_id"):
            order["user_id"] = str(order["user_id"])
        # Ensure datetime fields are JSON-serializable
        for key in ("created_at", "updated_at"):
            if isinstance(order.get(key), datetime):
                order[key] = order[key].isoformat()
        orders.append(order)

    return jsonify({"orders": orders})

@bp.get("/me/orders/<order_id>")
@jwt_required()
def get_my_order_details(order_id):
    """Get details for a specific order for the currently authenticated user"""
    from datetime import datetime

    db = current_app.extensions.get('mongo_db')
    user_id = get_jwt_identity()

    if not user_id:
        return jsonify({"error": "authentication_required"}), 401

    # PyMongo Database objects don't support truthiness; compare explicitly to None
    if db is None:
        return jsonify({"error": "Database not available"}), 503

    # Validate order_id format
    try:
        order_oid = _oid(order_id)
        if not order_oid:
            return jsonify({"error": "invalid_order_id"}), 400
    except:
        return jsonify({"error": "invalid_order_id"}), 400

    # Get the specific order for current user
    order = db.orders.find_one({
        "_id": order_oid,
        "user_id": _oid(user_id)
    }, {"provider": 0, "provider_order": 0, "razorpay_order_id": 0, "payment_id": 0, "signature": 0})

    if not order:
        return jsonify({"error": "order_not_found"}), 404

    # Convert ObjectId to string for JSON serialization
    order["_id"] = str(order["_id"])
    if order.get("user_id"):
        order["user_id"] = str(order["user_id"])
    
    # Ensure datetime fields are JSON-serializable
    for key in ("created_at", "updated_at"):
        if isinstance(order.get(key), datetime):
            order[key] = order[key].isoformat()

    return jsonify({"order": order})

@bp.put("/<customer_id>")
@jwt_required()
@require_permissions("*")
def update_customer(customer_id):
    """Update customer information"""
    db = current_app.extensions['mongo_db']
    
    customer_oid = _oid(customer_id)
    if not customer_oid:
        return jsonify({"error": "invalid_customer_id"}), 400
    
    data = request.get_json() or {}
    
    # Validate customer exists
    customer = db.users.find_one({"_id": customer_oid, "role.role_name": "Customer"})
    if not customer:
        return jsonify({"error": "customer_not_found"}), 404
    
    # Prepare update data
    update_data = {}
    if "full_name" in data:
        update_data["full_name"] = data["full_name"]
    if "phone_number" in data:
        update_data["phone_number"] = data["phone_number"]
    if "status" in data and data["status"] in ["active", "inactive"]:
        update_data["status"] = data["status"]
    
    if not update_data:
        return jsonify({"error": "no_valid_fields"}), 400
    
    update_data["updated_at"] = _now(db)
    
    # Update customer
    result = db.users.update_one(
        {"_id": customer_oid},
        {"$set": update_data}
    )
    
    if result.modified_count:
        return jsonify({"message": "customer_updated"})
    else:
        return jsonify({"error": "update_failed"}), 500

@bp.get("/analytics/summary")
@jwt_required()
@require_permissions("*")
def get_customer_analytics():
    """Get customer analytics and summary statistics"""
    db = current_app.extensions['mongo_db']
    
    # Get total customers
    total_customers = db.users.count_documents({"role.role_name": "Customer", "status": "active"})
    
    # Get new customers this month
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_customers_this_month = db.users.count_documents({
        "role.role_name": "Customer",
        "status": "active",
        "created_at": {"$gte": start_of_month}
    })
    
    # Get customers by registration month (last 6 months)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    customer_registrations = []
    
    for i in range(6):
        month_start = (datetime.utcnow() - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        count = db.users.count_documents({
            "role.role_name": "Customer",
            "status": "active",
            "created_at": {"$gte": month_start, "$lt": month_end}
        })
        
        customer_registrations.append({
            "month": month_start.strftime("%Y-%m"),
            "count": count
        })
    
    # Real analytics based on actual customer data
    analytics = {
        "total_customers": total_customers,
        "new_customers_this_month": new_customers_this_month,
        "customer_growth": customer_registrations,
        "top_customers": [],  # Will be populated when ordering system is implemented
        "average_order_value": 0,  # Will be calculated when ordering system is implemented
        "repeat_customer_rate": 0.0  # Will be calculated when ordering system is implemented
    }
    
    return jsonify(analytics)


# ---------------- User-specific Wishlist & Cart ----------------

@bp.get("/me/wishlist")
@jwt_required()
def get_my_wishlist():
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400
    doc = db.wishlists.find_one({"user_id": user_oid}) or {"items": []}
    items = doc.get("items", [])
    return jsonify({"items": items})


@bp.put("/me/wishlist")
@jwt_required()
def put_my_wishlist():
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400
    data = request.get_json() or {}
    items = data.get("items", [])
    if not isinstance(items, list):
        return jsonify({"error": "bad_items"}), 400
    db.wishlists.update_one(
        {"user_id": user_oid},
        {"$set": {"items": items, "updated_at": _now(db)}},
        upsert=True,
    )
    return jsonify({"saved": True})


@bp.get("/me/cart")
@jwt_required()
def get_my_cart():
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400
    doc = db.carts.find_one({"user_id": user_oid}) or {"items": []}
    items = doc.get("items", [])
    return jsonify({"items": items})


@bp.put("/me/cart")
@jwt_required()
def put_my_cart():
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400
    data = request.get_json() or {}
    items = data.get("items", [])
    if not isinstance(items, list):
        return jsonify({"error": "bad_items"}), 400
    db.carts.update_one(
        {"user_id": user_oid},
        {"$set": {"items": items, "updated_at": _now(db)}},
        upsert=True,
    )
    return jsonify({"saved": True})


# ---------------- Current user profile ----------------

@bp.get("/me")
@jwt_required()
def get_me():
    """Return current user's profile (safe fields)."""
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400

    user = db.users.find_one({"_id": user_oid})
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    role_info = user.get("role") or {}
    safe = {
        "id": str(user.get("_id")),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "phone_number": user.get("phone_number"),
        "address": user.get("address"),
        "role": {
            "_id": str(role_info.get("_id")) if role_info.get("_id") else None,
            "role_name": role_info.get("role_name"),
        },
        "roles": user.get("roles", []),
        "perms": user.get("permissions", []),
    }
    return jsonify(safe)


@bp.patch("/me")
@jwt_required()
def patch_me():
    """Update current user's basic profile fields."""
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400

    data = request.get_json() or {}
    allowed = {"full_name", "phone_number", "address"}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        return jsonify({"error": "no_valid_fields"}), 400

    update["updated_at"] = _now(db)
    res = db.users.update_one({"_id": user_oid}, {"$set": update})
    if not res.matched_count:
        return jsonify({"error": "user_not_found"}), 404

    # Return updated document snippet
    user = db.users.find_one({"_id": user_oid}, {"full_name": 1, "phone_number": 1, "address": 1})
    return jsonify({
        "message": "profile_updated",
        "full_name": user.get("full_name"),
        "phone_number": user.get("phone_number"),
        "address": user.get("address"),
    })


@bp.patch("/me/password")
@jwt_required()
def change_password():
    """Change current user's password, verifying the old password."""
    db = current_app.extensions['mongo_db']
    uid = get_jwt_identity()
    user_oid = _oid(uid)
    if not user_oid:
        return jsonify({"error": "invalid_user"}), 400

    data = request.get_json() or {}
    old_pw = (data.get("old_password") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if not old_pw or not new_pw:
        return jsonify({"error": "validation_failed", "details": {"password": ["Both old_password and new_password are required."]}}), 400

    user = db.users.find_one({"_id": user_oid})
    if not user or not user.get("password_hash"):
        return jsonify({"error": "user_not_found"}), 404

    if not verify_password(old_pw, user["password_hash"]):
        return jsonify({"error": "invalid_old_password"}), 400

    new_hash = hash_password(new_pw)
    db.users.update_one({"_id": user_oid}, {"$set": {"password_hash": new_hash, "updated_at": _now(db)}})
    return jsonify({"message": "password_updated"})
