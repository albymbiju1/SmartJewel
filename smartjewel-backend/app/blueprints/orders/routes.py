from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from datetime import datetime

bp = Blueprint("orders", __name__, url_prefix="/api/orders")


def _oid(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def _maybe_auto_mark_paid(db, order: dict):
    """Auto-mark Razorpay orders as paid if they have a payment_id (indicating successful payment).
    We ignore provider_order.status since Razorpay keeps it as 'created' even after payment.
    """
    if not order:
        return order
    
    # Only process Razorpay orders that have a payment_id (successful payment indicator)
    is_razorpay = order.get("provider") == "razorpay" or order.get("payment_provider") == "razorpay"
    has_payment_id = bool(order.get("payment_id") or order.get("razorpay_payment_id"))
    
    if not (is_razorpay and has_payment_id):
        return order
    
    # Check if already marked paid in our system status
    current_status = (order.get("status") or "").lower()
    if current_status == "paid":
        return order
    
    # Also check statusHistory for paid status
    hist = order.get("statusHistory") or []
    already_paid = any((h.get("status") or "").lower() == "paid" for h in hist)
    if already_paid:
        return order
    
    now = datetime.utcnow()
    try:
        db.orders.update_one({"_id": order.get("_id")}, {
            "$push": {"statusHistory": {"status": "paid", "timestamp": now, "by": "system:auto", "notes": "Razorpay payment confirmed via payment_id"}},
            "$set": {"status": "paid", "payment_status": "paid", "updatedAt": now}
        })
        (order.setdefault("statusHistory", [])).append({"status": "paid", "timestamp": now})
        order["status"] = "paid"
        order["payment_status"] = "paid"
        print(f"Auto-marked order {order.get('_id')} as paid (had payment_id: {order.get('payment_id')})")
    except Exception as e:
        print(f"Failed to auto-mark order {order.get('_id')} as paid: {e}")
    
    return order


@bp.route("/my-orders", methods=["OPTIONS"])  # CORS preflight without auth
def options_my_orders():
    return ("", 204)


@bp.route("/my-orders", methods=["GET"]) 
@jwt_required()
def get_my_orders():
    """Return orders for the logged-in user filtered by customer.userId.

    Returns minimal fields: orderId, items, statusHistory, amount, createdAt, shipping.status
    Sorted by createdAt desc.
    """
    db = current_app.extensions.get('mongo_db')
    uid = get_jwt_identity()
    claims = get_jwt() or {}
    email = (claims.get("email") or "").lower()
    user_oid = _oid(uid)

    if not uid or not user_oid:
        return jsonify({"error": "authentication_required"}), 401
    if db is None:
        return jsonify({"orders": [], "message": "Database not available"}), 503

    projection = {
        "items": 1,
        "statusHistory": 1,
        "totalAmount": 1,
        "createdAt": 1,
        "shipping.status": 1,
        "customer.userId": 1,
        "customer.email": 1,
        "cancellation": 1,
        # legacy fields
        "created_at": 1,
        "amount": 1,
        "delivery_status": 1,
        "status": 1,
        "payment_status": 1,
        "user_id": 1,
    }

    # Backward-compat filter: customer.userId == uid OR customer.email == email OR legacy user_id == ObjectId(uid)
    query = {"$or": [{"customer.userId": uid}]} if uid else {"$or": []}
    if email:
        query["$or"].append({"customer.email": email})
    if user_oid:
        query["$or"].append({"user_id": user_oid})
    if not query["$or"]:
        return jsonify({"orders": []})

    # Exclude logical deletions
    query = {"$and": [query, {"deleted": {"$ne": True}}]}
    cursor = db.orders.find(query, projection).sort("createdAt", -1)
    results = []
    for doc in cursor:
        # ensure paid reflection
        full = db.orders.find_one({"_id": doc.get("_id")}) or doc
        _maybe_auto_mark_paid(db, full)
        created_at = doc.get("createdAt") or doc.get("created_at")
        if isinstance(created_at, datetime):
            created_at_str = created_at.isoformat()
        else:
            created_at_str = created_at
        amount_val = doc.get("totalAmount")
        if amount_val is None:
            amount_val = doc.get("amount", 0)

        # shipping status from new or legacy
        ship_status = None
        if isinstance(doc.get("shipping"), dict):
            ship_status = (doc.get("shipping") or {}).get("status")
        if not ship_status:
            ship_status = doc.get("delivery_status")

        results.append({
            "orderId": str(doc.get("_id")),
            "items": doc.get("items", []),
            "statusHistory": doc.get("statusHistory", []),
            "amount": amount_val,
            "createdAt": created_at_str,
            "cancellation": doc.get("cancellation") or {},
        })

    return jsonify({"orders": results})


# CORS preflight for order details
@bp.route("/<order_id>", methods=["OPTIONS"])
def options_order_detail(order_id: str):
    return ("", 204)


@bp.route("/<order_id>", methods=["GET"])
@jwt_required()
def get_order_details(order_id: str):
    """Return full order details for a given order if requester owns it or is admin.

{{ ... }}
    """
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    uid = get_jwt_identity()
    claims = get_jwt() or {}
    roles = claims.get("roles", []) or []
    email = (claims.get("email") or "").lower()
    user_oid = _oid(uid)

    # Validate order id
    try:
        order_oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    order = db.orders.find_one({"_id": order_oid, "deleted": {"$ne": True}})
    if not order:
        return jsonify({"error": "order_not_found"}), 404
    # ensure paid reflection
    order = _maybe_auto_mark_paid(db, order)

    # Authorization: admin can view any; else must match ownership by userId/email/legacy user_id
    is_admin = any(str(r).lower() == 'admin' for r in roles)
    owner_match = False
    try:
        if order.get("customer", {}).get("userId") and uid and order["customer"]["userId"] == uid:
            owner_match = True
        if not owner_match and email and (order.get("customer", {}).get("email") or '').lower() == email:
            owner_match = True
        if not owner_match and user_oid and order.get("user_id") and order["user_id"] == user_oid:
            owner_match = True
    except Exception:
        owner_match = False

    if not (is_admin or owner_match):
        return jsonify({"error": "forbidden"}), 403

    # Normalize fields
    created_at = order.get("createdAt") or order.get("created_at")
    updated_at = order.get("updatedAt") or order.get("updated_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()

    amount_val = order.get("totalAmount")
    if amount_val is None:
        amount_val = order.get("amount", 0)

    payment = {
        "provider": order.get("provider"),
        "status": (order.get("provider_order") or {}).get("status"),
        "currency": (order.get("provider_order") or {}).get("currency"),
        "amount": (order.get("provider_order") or {}).get("amount"),
        "receipt": (order.get("provider_order") or {}).get("receipt"),
        "transactionId": (order.get("provider_order") or {}).get("transactionId") or order.get("payment_id"),
    }

    shipping = order.get("shipping") if isinstance(order.get("shipping"), dict) else None
    if not shipping:
        shipping = {
            "address": (order.get("customer") or {}).get("address"),
            "method": None,
            "trackingId": order.get("tracking_number") or None,
            "status": order.get("delivery_status") or None,
        }

    res = {
        "orderId": str(order.get("_id")),
        "items": order.get("items", []),
        "statusHistory": order.get("statusHistory", []),
        "shipping": shipping,
        "amount": amount_val,
        "payment": payment,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "customer": order.get("customer"),
        "cancellation": order.get("cancellation") or {},
    }

    return jsonify({"order": res})


# CORS preflight for user cancellation
@bp.route("/<order_id>/cancel", methods=["OPTIONS"])
def options_user_cancel(order_id: str):
    return ("", 204)


@bp.route("/<order_id>/cancel", methods=["POST"]) 
@jwt_required()
def request_cancellation(order_id: str):
    """User requests cancellation with reason.

    Allowed only if last status is created/pending/paid and not already requested.
    Pushes statusHistory: {status: 'cancellation requested'} and sets cancellation fields.
    """
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    uid = get_jwt_identity()
    claims = get_jwt() or {}
    email = (claims.get("email") or "").lower()
    user_oid = _oid(uid)

    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    order = db.orders.find_one({"_id": oid})
    if not order:
        return jsonify({"error": "order_not_found"}), 404

    # Ownership check
    owner_match = False
    try:
        if order.get("customer", {}).get("userId") and uid and order["customer"]["userId"] == uid:
            owner_match = True
        if not owner_match and email and (order.get("customer", {}).get("email") or '').lower() == email:
            owner_match = True
        if not owner_match and user_oid and order.get("user_id") and order["user_id"] == user_oid:
            owner_match = True
    except Exception:
        owner_match = False

    if not owner_match:
        return jsonify({"error": "forbidden"}), 403

    # Parse JSON body safely
    try:
        from flask import request as _flask_request
        body = _flask_request.get_json(silent=True) or {}
    except Exception:
        body = {}

    reason = (body.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "validation_failed", "details": {"reason": ["reason is required"]}}), 400

    # Determine last status
    last_status = None
    hist = order.get("statusHistory") or []
    if hist:
        last_status = (hist[-1].get("status") or "").lower()
    if not last_status:
        last_status = (order.get("status") or order.get("delivery_status") or order.get("payment_status") or "").lower()

    allowed_statuses = {"created", "pending", "paid"}
    if last_status not in allowed_statuses:
        return jsonify({"error": "not_allowed", "message": "Order cannot be cancelled in current status."}), 400

    cancellation = order.get("cancellation") or {}
    if cancellation.get("requested"):
        return jsonify({"error": "already_requested"}), 400

    now = datetime.utcnow()
    update = {
        "$set": {
            "cancellation": {
                "requested": True,
                "reason": reason,
                "requestedAt": now,
                "approved": False,
                "approvedAt": None,
                "refundProcessed": False,
                "refundDetails": {},
            },
            "updatedAt": now,
        },
        "$push": {"statusHistory": {"status": "cancellation requested", "timestamp": now, "by": uid, "notes": reason}},
    }

    db.orders.update_one({"_id": oid}, update)
    return jsonify({"ok": True})


@bp.route("/track/<order_id>", methods=["GET"])
def track_order(order_id: str):
    """Public endpoint to track order status by order ID."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    try:
        oid = ObjectId(order_id)
        order = db.orders.find_one({"_id": oid, "deleted": {"$ne": True}})
    except Exception:
        # If ObjectId conversion fails, try string match
        order = db.orders.find_one({"_id": order_id, "deleted": {"$ne": True}})
    
    # If still not found, try alternative fields
    if not order:
        order = db.orders.find_one({
            "$and": [
                {"deleted": {"$ne": True}},
                {"$or": [
                    {"order_id": order_id},
                    {"tracking_number": order_id}
                ]}
            ]
        })
    
    if not order:
        return jsonify({"error": "order_not_found"}), 404

    # Get the latest status
    status = "unknown"
    status_history = order.get("statusHistory", [])
    if status_history:
        status = status_history[-1].get("status", "unknown")
    else:
        status = order.get("status", "unknown")
    
    # Check for cancellation
    cancellation = order.get("cancellation", {})
    if cancellation.get("requested"):
        status = "cancellation requested"
    elif cancellation.get("approved"):
        status = "cancellation approved"
    
    created_at = order.get("createdAt") or order.get("created_at")
    
    return jsonify({
        "orderId": str(order.get("_id")),
        "status": status,
        "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
        "trackingNumber": order.get("tracking_number"),
        "cancellation": cancellation
    })
