from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.authz import require_roles, require_permissions
from bson import ObjectId
from datetime import datetime, timedelta
import logging

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
    
    # Purchase history will be empty until ordering system is implemented
    purchase_history = []
    
    # Calculate customer statistics (empty for now)
    total_orders = 0
    total_spent = 0
    avg_order_value = 0
    last_order_date = None
    
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
            "total_spent": total_spent,
            "avg_order_value": round(avg_order_value, 2),
            "last_order_date": last_order_date
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
    
    # Orders will be empty until ordering system is implemented
    orders = []
    
    return jsonify({"orders": orders})

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
