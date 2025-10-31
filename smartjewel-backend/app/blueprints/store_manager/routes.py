from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.utils.authz import require_any_role, require_permissions
from bson import ObjectId
from datetime import datetime

bp = Blueprint("store_manager", __name__, url_prefix="/api/store-manager")


def _oid(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def _normalize_order(order: dict) -> dict:
    if not order:
        return {}
    created_at = order.get("createdAt") or order.get("created_at") or order.get("_computedCreatedAt")
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
        "status": order.get("payment_status") or order.get("status"),  # Use our system status, not provider_order.status
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
    return {
        "orderId": str(order.get("_id", "")),
        "items": order.get("items", []),
        "statusHistory": order.get("statusHistory", []),
        "shipping": shipping,
        "amount": amount_val,
        "payment": payment,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "customer": order.get("customer"),
        "status": (order.get("statusHistory") or [{}])[-1].get("status") if order.get("statusHistory") else order.get("status"),
        "cancellation": order.get("cancellation") or {},
    }


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
        # Reflect in-memory for current response
        (order.setdefault("statusHistory", [])).append({"status": "paid", "timestamp": now})
        order["status"] = "paid"
        order["payment_status"] = "paid"
        print(f"Auto-marked order {order.get('_id')} as paid (had payment_id: {order.get('payment_id')})")
    except Exception as e:
        print(f"Failed to auto-mark order {order.get('_id')} as paid: {e}")
    
    return order


@bp.route("/orders", methods=["GET"])
@require_permissions("orders.manage")  # Store Manager
@jwt_required()
def list_store_orders():
    """List orders for the store manager's store with pagination, sorting, and filtering."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"orders": [], "message": "Database not available"}), 503

    # Get current user to determine their store
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user or not user.get("store_id"):
        return jsonify({"error": "no_store_assigned"}), 400

    store_id = user.get("store_id")

    # Pagination
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    skip = (page - 1) * limit

    # Sorting: newest first by default (createdAt/created_at desc)
    sort_by = request.args.get("sortBy")
    sort_dir = -1 if (request.args.get("sortDir") or "desc").lower() in ("desc", "-1") else 1

    # Filters
    status = (request.args.get("status") or "").strip().lower()  # created/paid/shipped/delivered/cancelled
    q = (request.args.get("q") or "").strip().lower()  # customer search name/email/phone/orderId
    date_from = request.args.get("from")
    date_to = request.args.get("to")

    # Build query to filter orders for this store
    query = {"store_id": _oid(store_id)}
    ands = []

    if status:
        # Match last status in statusHistory or legacy status
        ands.append({
            "$or": [
                {"statusHistory": {"$elemMatch": {"status": {"$regex": f"^{status}$", "$options": "i"}}}},
                {"status": {"$regex": f"^{status}$", "$options": "i"}}
            ]
        })

    if q:
        try:
            maybe_oid = ObjectId(q)
        except Exception:
            maybe_oid = None
        ors = [
            {"customer.name": {"$regex": q, "$options": "i"}},
            {"customer.email": {"$regex": q, "$options": "i"}},
            {"customer.phone": {"$regex": q, "$options": "i"}},
        ]
        if maybe_oid:
            ors.append({"_id": maybe_oid})  # type: ignore
        ands.append({"$or": ors})

    # Date range on createdAt/created_at
    dr_or = []
    rng = {}
    if date_from:
        try:
            rng["$gte"] = datetime.fromisoformat(date_from)
        except Exception:
            pass
    if date_to:
        try:
            rng["$lte"] = datetime.fromisoformat(date_to)
        except Exception:
            pass
    if rng:
        dr_or.append({"createdAt": rng})
        dr_or.append({"created_at": rng})
        ands.append({"$or": dr_or})

    if ands:
        query["$and"] = ands  # type: ignore
    else:
        query = {"store_id": _oid(store_id)}
    # Exclude logical deletions globally
    query = {"$and": [query, {"deleted": {"$ne": True}}]}

    # Build aggregation to compute a consistent created date for sorting and display
    total = db.orders.count_documents(query)
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "_createdAtConv": {"$convert": {"input": "$createdAt", "to": "date", "onError": None, "onNull": None}},
            "_created_atConv": {"$convert": {"input": "$created_at", "to": "date", "onError": None, "onNull": None}},
        }},
        {"$addFields": {
            "_sortDate": {"$ifNull": ["$_createdAtConv", {"$ifNull": ["$_created_atConv", {"$toDate": "$_id"}]}]},
            "_computedCreatedAt": {"$ifNull": ["$_createdAtConv", {"$ifNull": ["$_created_atConv", {"$toDate": "$_id"}]}]},
        }},
    ]
    # Sorting
    if sort_by:
        if sort_by in ("createdAt", "created_at"):
            pipeline.append({"$sort": {"_sortDate": sort_dir}})
        else:
            pipeline.append({"$sort": {sort_by: sort_dir, "_sortDate": -1}})
    else:
        pipeline.append({"$sort": {"_sortDate": -1}})

    pipeline.extend([{"$skip": skip}, {"$limit": limit}])

    cursor = db.orders.aggregate(pipeline)
    orders = []
    for doc in cursor:
        # best-effort: try to fetch full order for payment/provider fields not in pipeline
        full = db.orders.find_one({"_id": doc.get("_id")}) or doc
        full = _maybe_auto_mark_paid(db, full)
        orders.append(_normalize_order(full))

    return jsonify({
        "orders": orders,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
        "sort": {"by": sort_by or ["createdAt","created_at"], "dir": "desc" if sort_dir == -1 else "asc"},
        "filters": {"status": status or None, "q": q or None, "from": date_from, "to": date_to}
    })


@bp.route("/orders/summary", methods=["GET"])
@require_permissions("orders.manage")  # Store Manager
@jwt_required()
def get_store_orders_summary():
    """Get order summary statistics for the store manager's store."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    # Get current user to determine their store
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user or not user.get("store_id"):
        return jsonify({"error": "no_store_assigned"}), 400

    store_id = user.get("store_id")

    # Build query to filter orders for this store
    query = {"store_id": _oid(store_id), "deleted": {"$ne": True}}

    # Get total orders count
    total_orders = db.orders.count_documents(query)

    # Get delivered orders count
    delivered_query = {"$and": [query, {"status": "delivered"}]}
    delivered_count = db.orders.count_documents(delivered_query)

    # Get paid orders count
    paid_query = {"$and": [query, {"status": "paid"}]}
    paid_count = db.orders.count_documents(paid_query)

    # Get pending orders count (created status)
    pending_query = {"$and": [query, {"status": "created"}]}
    pending_count = db.orders.count_documents(pending_query)

    return jsonify({
        "totalOrders": total_orders,
        "delivered": delivered_count,
        "paid": paid_count,
        "pending": pending_count
    })


@bp.route("/orders/<order_id>/status", methods=["PATCH"])
@require_permissions("orders.manage")  # Store Manager
@jwt_required()
def update_order_status(order_id: str):
    """Update order status for store manager."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    # Get current user to determine their store
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user or not user.get("store_id"):
        return jsonify({"error": "no_store_assigned"}), 400

    store_id = user.get("store_id")
    
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    # Verify order belongs to this store
    order = db.orders.find_one({"_id": oid, "store_id": _oid(store_id)})
    if not order:
        return jsonify({"error": "order_not_found_or_unauthorized"}), 404

    body = request.get_json() or {}
    new_status = (body.get("status") or "").strip()
    note = (body.get("note") or "").strip() or None
    if not new_status:
        return jsonify({"error": "validation_failed", "details": {"status": ["status is required"]}}), 400

    claims = get_jwt() or {}
    actor = get_jwt_identity()

    # Determine old status for notification logic
    old_status = None
    hist = order.get("statusHistory") or []
    if hist:
        old_status = (hist[-1].get("status") or "").lower()
    if not old_status:
        old_status = (order.get("status") or "").lower()

    # push into statusHistory and set status for convenience if you store it
    now = datetime.utcnow()
    update = {
        "$push": {"statusHistory": {"status": new_status.lower(), "timestamp": now, "by": actor, "notes": note}},
        "$set": {"updatedAt": now}
    }
    # also mirror a top-level status field for easier filtering if exists
    update["$set"]["status"] = new_status.lower()

    res = db.orders.update_one({"_id": oid}, update)
    if not res.matched_count:
        return jsonify({"error": "not_found"}), 404

    # Send notification if status changed to a notify-worthy status
    from app.services.notification_service import send_order_status_notification
    if old_status != new_status.lower():
        send_order_status_notification(order, new_status.lower())

    doc = db.orders.find_one({"_id": oid})
    return jsonify({"order": _normalize_order(doc)})


@bp.route("/appointments", methods=["GET"])
@require_permissions("appointments.manage")  # Store Manager
@jwt_required()
def list_store_appointments():
    """List appointments for the store manager's store."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"appointments": [], "message": "Database not available"}), 503

    # Get current user to determine their store
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user or not user.get("store_id"):
        return jsonify({"error": "no_store_assigned"}), 400

    store_id = user.get("store_id")

    # Get appointments for this store
    appointments = list(db.appointments.find({"store_id": _oid(store_id)}).sort("created_at", -1))

    # Normalize appointment data
    normalized_appointments = []
    for appointment in appointments:
        normalized_appointments.append({
            "id": str(appointment.get("_id", "")),
            "customer_name": appointment.get("customer_name", ""),
            "customer_email": appointment.get("customer_email", ""),
            "customer_phone": appointment.get("customer_phone", ""),
            "preferred_date": appointment.get("preferred_date", ""),
            "preferred_time": appointment.get("preferred_time", ""),
            "notes": appointment.get("notes", ""),
            "status": appointment.get("status", "pending"),
            "created_at": appointment.get("created_at", "").isoformat() if isinstance(appointment.get("created_at"), datetime) else appointment.get("created_at", "")
        })

    return jsonify({"appointments": normalized_appointments})


@bp.route("/appointments/<appointment_id>/<action>", methods=["PATCH"])
@require_permissions("appointments.manage")  # Store Manager
@jwt_required()
def update_appointment_status(appointment_id: str, action: str):
    """Approve or reject an appointment."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    # Get current user to determine their store
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user or not user.get("store_id"):
        return jsonify({"error": "no_store_assigned"}), 400

    store_id = user.get("store_id")
    
    try:
        oid = ObjectId(appointment_id)
    except Exception:
        return jsonify({"error": "invalid_appointment_id"}), 400

    # Verify appointment belongs to this store
    appointment = db.appointments.find_one({"_id": oid, "store_id": _oid(store_id)})
    if not appointment:
        return jsonify({"error": "appointment_not_found_or_unauthorized"}), 404

    if action not in ["approve", "reject"]:
        return jsonify({"error": "invalid_action"}), 400

    # Update appointment status
    new_status = "approved" if action == "approve" else "rejected"
    notes = request.json.get("notes", "") if request.json else ""
    
    now = datetime.utcnow()
    update = {
        "$set": {
            "status": new_status,
            "updated_at": now
        }
    }
    
    if notes:
        update["$set"]["admin_notes"] = notes

    res = db.appointments.update_one({"_id": oid}, update)
    if not res.matched_count:
        return jsonify({"error": "not_found"}), 404

    updated_appointment = db.appointments.find_one({"_id": oid})
    return jsonify({
        "appointment": {
            "id": str(updated_appointment.get("_id", "")),
            "customer_name": updated_appointment.get("customer_name", ""),
            "customer_email": updated_appointment.get("customer_email", ""),
            "customer_phone": updated_appointment.get("customer_phone", ""),
            "preferred_date": updated_appointment.get("preferred_date", ""),
            "preferred_time": updated_appointment.get("preferred_time", ""),
            "notes": updated_appointment.get("notes", ""),
            "status": updated_appointment.get("status", "pending"),
            "created_at": updated_appointment.get("created_at", "").isoformat() if isinstance(updated_appointment.get("created_at"), datetime) else updated_appointment.get("created_at", "")
        }
    })