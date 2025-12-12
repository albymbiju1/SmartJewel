from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.utils.authz import require_any_role
from bson import ObjectId
from datetime import datetime

import requests
from urllib.parse import urlparse
from statistics import mean
bp = Blueprint("admin_orders", __name__, url_prefix="/api/admin/orders")


def _oid(id_str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def _normalize_order(order: dict) -> dict:
    if not order:
        return None
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


@bp.route("", methods=["OPTIONS"])  # preflight
def options_root():
    return ("", 204)


@bp.route("", methods=["GET"])
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def list_orders():
    """List orders with pagination, sorting, and filtering."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"orders": [], "message": "Database not available"}), 503

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

    query = {}
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
            ors.append({"_id": maybe_oid})
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
        query["$and"] = ands
    else:
        query = {}
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


@bp.route("/<order_id>", methods=["GET"]) 
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def get_order(order_id: str):
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400
    doc = db.orders.find_one({"_id": oid})
    doc = _maybe_auto_mark_paid(db, doc)
    if not doc:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"order": _normalize_order(doc)})


@bp.route("/<order_id>/status", methods=["OPTIONS"])  # preflight
def options_update_status(order_id):
    return ("", 204)


@bp.route("/<order_id>/status", methods=["PATCH"])
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def update_status(order_id: str):
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    body = request.get_json() or {}
    new_status = (body.get("status") or "").strip()
    note = (body.get("note") or "").strip() or None
    if not new_status:
        return jsonify({"error": "validation_failed", "details": {"status": ["status is required"]}}), 400

    claims = get_jwt() or {}
    actor = get_jwt_identity()

    # Get current order to check for status change
    current_order = db.orders.find_one({"_id": oid})
    if not current_order:
        return jsonify({"error": "not_found"}), 404

    # Determine old status for notification logic
    old_status = None
    hist = current_order.get("statusHistory") or []
    if hist:
        old_status = (hist[-1].get("status") or "").lower()
    if not old_status:
        old_status = (current_order.get("status") or "").lower()

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
    print(f"[Admin Orders] Status change: {old_status} -> {new_status.lower()}")
    if old_status != new_status.lower():
        print(f"[Admin Orders] Calling send_order_status_notification for order {oid}")
        result = send_order_status_notification(current_order, new_status.lower())
        print(f"[Admin Orders] Notification result: {result}")
    else:
        print(f"[Admin Orders] Status unchanged, skipping notification")

    doc = db.orders.find_one({"_id": oid})
    return jsonify({"order": _normalize_order(doc)})


# Maintenance: deduplicate orders by Razorpay order/payment identifiers
@bp.route("/maintenance/dedupe", methods=["POST"]) 
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def maintenance_dedupe():
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    # Ensure unique partial indexes to prevent future duplicates (best-effort)
    def ensure_index(keys, name, field, type_name="string"):
        try:
            db.orders.create_index(keys, name=name, unique=True, partialFilterExpression={field: {"$type": type_name}})
        except Exception:
            pass

    ensure_index([("provider_order.id", 1)], "uniq_provider_order_id", "provider_order.id")
    ensure_index([("payment_id", 1)], "uniq_payment_id", "payment_id")
    ensure_index([("provider_order.transactionId", 1)], "uniq_provider_txnId", "provider_order.transactionId")
    ensure_index([("provider_order.receipt", 1)], "uniq_provider_receipt", "provider_order.receipt")

    # Group duplicates and mark older ones as logically deleted
    def handle_group(key_field: str):
        total_groups = 0
        total_removed = 0
        pipeline = [
            {"$match": {key_field: {"$exists": True, "$ne": None}, "deleted": {"$ne": True}}},
            {"$group": {"_id": f"${key_field}", "ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        for group in db.orders.aggregate(pipeline):
            total_groups += 1
            ids = group.get("ids", [])
            if not ids:
                continue
            keep = max(ids)  # keep the newest ObjectId
            dupes = [i for i in ids if i != keep]
            if not dupes:
                continue
            now = datetime.utcnow()
            db.orders.update_many(
                {"_id": {"$in": dupes}},
                {"$set": {"deleted": True, "updatedAt": now}, "$push": {"statusHistory": {"status": "deleted duplicate", "timestamp": now, "by": "system:dedupe"}}}
            )
            total_removed += len(dupes)
        return total_groups, total_removed

    g1, r1 = handle_group("provider_order.id")
    g2, r2 = handle_group("payment_id")
    g3, r3 = handle_group("provider_order.transactionId")
    g4, r4 = handle_group("provider_order.receipt")

    return jsonify({
        "ok": True,
        "providerOrderIdGroups": g1, "providerOrderIdRemoved": r1,
        "paymentIdGroups": g2, "paymentIdRemoved": r2,
        "txnIdGroups": g3, "txnIdRemoved": r3,
        "receiptGroups": g4, "receiptIdRemoved": r4,
    })


# Maintenance: fix existing orders with successful Razorpay payments stuck in "created"/"confirmed"
@bp.route("/maintenance/fix-paid-status", methods=["POST"]) 
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def maintenance_fix_paid_status():
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    # Find Razorpay orders that have payment_id (successful payment) but status is not "paid"
    query = {
        "deleted": {"$ne": True},
        "$and": [
            {
                "$or": [
                    {"provider": "razorpay"},
                    {"payment_provider": "razorpay"}
                ]
            },
            {
                "$or": [
                    {"payment_id": {"$exists": True, "$ne": None}},
                    {"razorpay_payment_id": {"$exists": True, "$ne": None}}
                ]
            },
            {
                "status": {"$ne": "paid"}
            }
        ]
    }
    
    count_checked = 0
    count_updated = 0
    now = datetime.utcnow()
    
    for order in db.orders.find(query):
        count_checked += 1
        payment_id = order.get("payment_id") or order.get("razorpay_payment_id")
        
        # If there's a payment_id, it means payment was successful
        if payment_id:
            # Update to paid status
            hist = order.get("statusHistory") or []
            already_paid = any((h.get("status") or "").lower() == "paid" for h in hist)
            
            update_doc = {
                "$set": {
                    "status": "paid",
                    "payment_status": "paid",
                    "updatedAt": now
                }
            }
            
            if not already_paid:
                update_doc["$push"] = {
                    "statusHistory": {
                        "status": "paid",
                        "timestamp": now,
                        "by": "system:maintenance",
                        "notes": f"Fixed: Razorpay payment successful (payment_id: {payment_id}) but status was not updated"
                    }
                }
            
            db.orders.update_one({"_id": order["_id"]}, update_doc)
            count_updated += 1
            print(f"Fixed order {order['_id']} - had payment_id {payment_id} but status was {order.get('status')}")
    
    return jsonify({
        "ok": True,
        "checked": count_checked,
        "updated": count_updated,
        "message": f"Fixed {count_updated} orders out of {count_checked} checked"
    })


# Quick test endpoint to force auto-mark paid on all orders
@bp.route("/maintenance/force-auto-mark", methods=["POST"]) 
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def maintenance_force_auto_mark():
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    count_processed = 0
    count_updated = 0
    
    # Process all non-deleted orders
    for order in db.orders.find({"deleted": {"$ne": True}}):
        count_processed += 1
        original_status = order.get("status")
        updated_order = _maybe_auto_mark_paid(db, order)
        if updated_order.get("status") != original_status:
            count_updated += 1
    
    return jsonify({
        "ok": True,
        "processed": count_processed,
        "updated": count_updated
    })


@bp.route("/<order_id>/refund-status", methods=["GET"])
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def get_refund_status(order_id: str):
    """Get current refund status from Razorpay for an order"""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    order = db.orders.find_one({"_id": oid})
    if not order:
        return jsonify({"error": "not_found"}), 404

    refund_details = (order.get("cancellation") or {}).get("refundDetails")
    if not refund_details or not refund_details.get("refundId"):
        return jsonify({"error": "no_refund_found"}), 404

    try:
        from app.utils.razorpay_utils import get_refund_status
        
        refund_id = refund_details["refundId"]
        status_result = get_refund_status(refund_id)
        
        if status_result["success"]:
            # Update our database with latest status
            db.orders.update_one(
                {"_id": oid},
                {"$set": {
                    "cancellation.refundDetails.status": status_result["refund"]["status"],
                    "cancellation.refundDetails.lastChecked": datetime.utcnow().isoformat()
                }}
            )
            
            return jsonify({
                "refund": status_result["refund"],
                "updated": True
            })
        else:
            return jsonify({"error": status_result["error"]}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/forecast-total", methods=["OPTIONS"])  # preflight
def options_forecast_total():
    return ("", 204)


@bp.route("/forecast-total", methods=["GET"]) 
@require_any_role("Admin", "Staff_L3")
@jwt_required()
def forecast_total_sales():
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    try:
        horizon = int(request.args.get("horizon", "7"))
    except Exception:
        horizon = 7
    horizon = 30 if horizon >= 30 else 7

    pipeline = [
        {"$match": {"deleted": {"$ne": True}}},
        {"$match": {"$or": [
            {"payment_status": {"$regex": "^paid$", "$options": "i"}},
            {"status": {"$regex": "^paid$", "$options": "i"}},
            {"statusHistory": {"$elemMatch": {"status": {"$regex": "^paid$", "$options": "i"}}}}
        ]}},
        {"$addFields": {
            "_createdAtConv": {"$convert": {"input": "$createdAt", "to": "date", "onError": None, "onNull": None}},
            "_created_atConv": {"$convert": {"input": "$created_at", "to": "date", "onError": None, "onNull": None}},
        }},
        {"$addFields": {
            "_date": {"$ifNull": ["$_createdAtConv", {"$ifNull": ["$_created_atConv", {"$toDate": "$_id"}]}]},
            "_amount_choose": {"$ifNull": ["$totalAmount", {"$ifNull": ["$amount", None]}]},
            "_provider_amount": {"$ifNull": ["$provider_order.amount", 0]}
        }},
        {"$addFields": {
            "_amount": {"$ifNull": ["$_amount_choose", {"$divide": ["$_provider_amount", 100]}]}
        }},
    ]

    try:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=120)
        pipeline.append({"$match": {"_date": {"$gte": cutoff}}})
    except Exception:
        pass

    pipeline.extend([
        {"$addFields": {"_dayStr": {"$dateToString": {"date": "$_date", "format": "%Y-%m-%d"}}}},
        {"$group": {"_id": {"day": "$_dayStr"}, "qty": {"$sum": {"$ifNull": ["$_amount", 0]}}, "orders": {"$sum": 1}}},
        {"$project": {"_id": 0, "date": "$_id.day", "qty": 1}},
        {"$sort": {"date": 1}}
    ])

    cursor = db.orders.aggregate(pipeline)
    history = [{"date": d.get("date"), "qty": float(d.get("qty") or 0)} for d in cursor if d.get("date")]

    def _fallback_forecast(history_points, horizon_days):
        # Compute naive forecast using average of last up to 7 days
        recent_values = [p["qty"] for p in history_points[-7:]] if history_points else []
        baseline = mean(recent_values) if recent_values else 0.0
        # Determine last date in history to start forecasting from next day
        last_date_str = history_points[-1]["date"] if history_points else datetime.utcnow().strftime("%Y-%m-%d")
        last_date = datetime.strptime(last_date_str, "%Y-%m-%d")
        daily = []
        for i in range(1, horizon_days + 1):
            day = last_date + timedelta(days=i)
            daily.append({
                "date": day.strftime("%Y-%m-%d"),
                "forecast": round(float(baseline), 3)
            })
        sum_7 = round(sum([d["forecast"] for d in daily[:7]]), 3)
        sum_30 = round(sum([d["forecast"] for d in daily[:30]]), 3)
        return {
            "horizon_days": horizon_days,
            "daily": daily,
            "totals": {"sum_7": sum_7, "sum_30": sum_30}
        }

    try:
        # Build ML service URL robustly: accept full endpoint or a base URL
        default_path = "/ml/inventory/forecast"
        ml_url_env = current_app.config.get("ML_FORECAST_URL")
        ml_base_env = current_app.config.get("ML_BASE_URL")

        if ml_url_env:
            parsed = urlparse(ml_url_env)
            # If no specific path provided, or path is root, append full path
            if not parsed.path or parsed.path == "/":
                ml_url = ml_url_env.rstrip("/") + default_path
            # If pointing to parent paths, append the missing tail
            elif parsed.path.endswith("/ml") or parsed.path.endswith("/ml/"):
                ml_url = ml_url_env.rstrip("/") + "/inventory/forecast"
            elif parsed.path.endswith("/ml/inventory") or parsed.path.endswith("/ml/inventory/"):
                ml_url = ml_url_env.rstrip("/") + "/forecast"
            else:
                ml_url = ml_url_env
        elif ml_base_env:
            ml_url = (ml_base_env or "").rstrip("/") + default_path
        else:
            ml_url = "http://localhost:8085" + default_path

        payload = {"sku": "TOTAL_SALES_AMOUNT", "horizon_days": horizon, "recent_history": history}
        resp = requests.post(ml_url, json=payload, timeout=20)
        if resp.status_code != 200:
            # Fall back to naive forecast if remote ML not found or errors
            fallback = _fallback_forecast(history, horizon)
            fallback["mlProxy"] = {"error": "ml_service_error", "status": resp.status_code, "ml_url": ml_url}
            return jsonify(fallback)
        data = resp.json()
        return jsonify({
            "horizon_days": horizon,
            "daily": data.get("daily", []),
            "totals": data.get("totals", {})
        })
    except requests.exceptions.RequestException as e:
        # Network/timeout etc: provide fallback
        fallback = _fallback_forecast(history, horizon)
        fallback["mlProxy"] = {"error": "ml_proxy_failed", "message": str(e), "ml_url": locals().get("ml_url")}
        return jsonify(fallback)
    except Exception as e:
        fallback = _fallback_forecast(history, horizon)
        fallback["mlProxy"] = {"error": "ml_proxy_failed", "message": str(e), "ml_url": locals().get("ml_url")}
        return jsonify(fallback)
