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

    # Get current user
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user:
        return jsonify({"error": "user_not_found"}), 404

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

    # Build query to filter orders (all orders for store manager now)
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

    # Get current user
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    # Build query for all valid orders
    query = {"deleted": {"$ne": True}}

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
    
    # Get current user
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({"error": "invalid_order_id"}), 400

    # Find order
    order = db.orders.find_one({"_id": oid})
    if not order:
        return jsonify({"error": "order_not_found"}), 404

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

    # Send notification to customer
    try:
        from app.services.notification_service import send_appointment_notification
        send_appointment_notification(updated_appointment, new_status)
    except Exception as e:
        print(f"[Appointment] Failed to send notification: {e}")

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


# ---------------------------------------------------------------------------
# Discount management (store manager creates / activates discounts per item or category)
# ---------------------------------------------------------------------------

@bp.get("/discounts/public/sale-products")
def get_sale_products():
    """Public endpoint: returns products that have an active, non-expired discount."""
    try:
        db = current_app.extensions.get('mongo_db')
        if db is None:
            current_app.logger.error("sale-products: mongo_db extension not found")
            return jsonify({"error": "db_unavailable", "products": []}), 503

        now = datetime.utcnow()

        # Fetch all active discounts (simple query, no complex $and/$or)
        all_discounts = list(db.discounts.find({"active": True}))
        current_app.logger.info(f"sale-products: found {len(all_discounts)} active discounts")

        # Filter expired ones in Python to avoid query complexity
        active_discounts = []
        for d in all_discounts:
            end = d.get("end_date")
            if end and end < now:
                continue
            active_discounts.append(d)

        current_app.logger.info(f"sale-products: {len(active_discounts)} non-expired discounts")

        product_oids = []
        category_discounts = []

        for disc in active_discounts:
            if disc.get("scope") == "product":
                for pid in (disc.get("product_ids") or []):
                    try:
                        product_oids.append(ObjectId(pid) if not isinstance(pid, ObjectId) else pid)
                    except Exception:
                        pass
            elif disc.get("scope") == "category" and disc.get("category"):
                category_discounts.append(disc)

        def _safe_item(item, disc):
            """Return a minimal safe dict for a product with discount info."""
            base = float(item.get("price") or 0)
            dval = float(disc.get("discount_value") or 0)
            dtype = disc.get("discount_type", "percentage")
            damount = round(base * dval / 100, 2) if dtype == "percentage" else min(dval, base)
            discounted = round(max(0, base - damount), 2)
            return {
                "_id": str(item["_id"]),
                "name": item.get("name", ""),
                "category": item.get("category", ""),
                "metal": item.get("metal", ""),
                "image": item.get("image", ""),
                "original_price": base,
                "price": discounted,
                "active_discount": {
                    "discount_type": dtype,
                    "discount_value": dval,
                    "discount_amount": damount,
                    "discounted_price": discounted,
                }
            }

        results = []
        seen_ids = set()

        # Products by ID
        if product_oids:
            items = list(db.items.find({"_id": {"$in": product_oids}, "status": "active"}))
            for item in items:
                item_id_str = str(item["_id"])
                if item_id_str in seen_ids:
                    continue
                # Find matching discount
                for disc in active_discounts:
                    if disc.get("scope") == "product":
                        disc_pids = [str(p) for p in (disc.get("product_ids") or [])]
                        if item_id_str in disc_pids:
                            results.append(_safe_item(item, disc))
                            seen_ids.add(item_id_str)
                            break

        # Products by category
        for disc in category_discounts:
            cat = (disc.get("category") or "").strip()
            if not cat:
                continue
            cat_items = list(db.items.find(
                {"category": {"$regex": f"^{cat}$", "$options": "i"}, "status": "active"}
            ).limit(10))
            for item in cat_items:
                item_id_str = str(item["_id"])
                if item_id_str in seen_ids:
                    continue
                results.append(_safe_item(item, disc))
                seen_ids.add(item_id_str)

        current_app.logger.info(f"sale-products: product_oids={len(product_oids)}, category_discounts={len(category_discounts)}")
        current_app.logger.info(f"sale-products: returning {len(results)} products")
        return jsonify({"products": results, "total": len(results)})

    except Exception as e:
        current_app.logger.exception(f"sale-products endpoint failed: {e}")
        return jsonify({"error": str(e), "products": []}), 500


def _serialize_discount(d: dict) -> dict:
    """Normalize a discount document for JSON output."""
    d = dict(d)
    d["_id"] = str(d["_id"])
    d["product_ids"] = [str(pid) for pid in (d.get("product_ids") or [])]
    for field in ("start_date", "end_date", "created_at", "updated_at"):
        if d.get(field) and isinstance(d[field], datetime):
            d[field] = d[field].isoformat()
    return d


@bp.route("/discounts", methods=["GET"])
@require_permissions("discount.approve")
@jwt_required()
def list_discounts():
    """List all discounts created by this store manager."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    user_id = get_jwt_identity()
    if not db.users.find_one({"_id": _oid(user_id)}):
        return jsonify({"error": "user_not_found"}), 404

    scope_filter = request.args.get("scope", "").strip()
    active_filter = request.args.get("active", "").strip().lower()
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    skip = (page - 1) * limit

    query = {}
    if scope_filter:
        query["scope"] = scope_filter
    if active_filter in ("true", "1"):
        query["active"] = True
    elif active_filter in ("false", "0"):
        query["active"] = False

    total = db.discounts.count_documents(query)
    docs = list(db.discounts.find(query).sort("created_at", -1).skip(skip).limit(limit))

    return jsonify({
        "discounts": [_serialize_discount(d) for d in docs],
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    })


@bp.route("/discounts", methods=["POST"])
@require_permissions("discount.approve")
@jwt_required()
def create_discount():
    """Create a new product/category discount."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": _oid(user_id)})
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    body = request.get_json() or {}
    name = (body.get("name") or "").strip()
    scope = (body.get("scope") or "").strip()
    discount_type = (body.get("discount_type") or "percentage").strip()
    discount_value = body.get("discount_value")

    errors = {}
    if not name:
        errors["name"] = ["name is required"]
    if scope not in ("product", "category"):
        errors["scope"] = ["scope must be 'product' or 'category'"]
    if discount_type not in ("percentage", "flat"):
        errors["discount_type"] = ["must be 'percentage' or 'flat'"]
    if discount_value is None:
        errors["discount_value"] = ["discount_value is required"]
    else:
        try:
            discount_value = float(discount_value)
            if discount_value <= 0:
                errors["discount_value"] = ["must be positive"]
            elif discount_type == "percentage" and discount_value > 100:
                errors["discount_value"] = ["percentage cannot exceed 100"]
        except (TypeError, ValueError):
            errors["discount_value"] = ["must be a number"]

    if scope == "product" and not (body.get("product_ids") or []):
        errors["product_ids"] = ["product_ids required when scope is 'product'"]
    if scope == "category" and not (body.get("category") or "").strip():
        errors["category"] = ["category required when scope is 'category'"]

    if errors:
        return jsonify({"error": "validation_failed", "details": errors}), 400

    start_date = None
    end_date = None
    if body.get("start_date"):
        try:
            start_date = datetime.fromisoformat(body["start_date"])
        except Exception:
            pass
    if body.get("end_date"):
        try:
            end_date = datetime.fromisoformat(body["end_date"])
        except Exception:
            pass

    now = datetime.utcnow()
    doc = {
        "name": name,
        "scope": scope,
        "discount_type": discount_type,
        "discount_value": float(discount_value),
        "start_date": start_date,
        "end_date": end_date,
        "active": bool(body.get("active", True)),
        "product_ids": [_oid(pid) for pid in (body.get("product_ids") or []) if _oid(pid)] if scope == "product" else [],
        "category": (body.get("category") or "").strip() if scope == "category" else None,
        "created_by": user_id,
        "created_by_name": user.get("name") or user.get("username") or user_id,
        "created_at": now,
        "updated_at": now,
    }

    result = db.discounts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({"discount": _serialize_discount(doc)}), 201


@bp.route("/discounts/<discount_id>", methods=["PATCH"])
@require_permissions("discount.approve")
@jwt_required()
def update_discount(discount_id: str):
    """Toggle active status, change value, or update dates on a discount."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    user_id = get_jwt_identity()
    if not db.users.find_one({"_id": _oid(user_id)}):
        return jsonify({"error": "user_not_found"}), 404

    oid = _oid(discount_id)
    if not oid:
        return jsonify({"error": "invalid_id"}), 400

    discount = db.discounts.find_one({"_id": oid})
    if not discount:
        return jsonify({"error": "not_found"}), 404

    body = request.get_json() or {}
    updates = {"updated_at": datetime.utcnow()}

    if "active" in body:
        updates["active"] = bool(body["active"])
    if "name" in body and (body["name"] or "").strip():
        updates["name"] = body["name"].strip()
    if "discount_value" in body:
        try:
            updates["discount_value"] = float(body["discount_value"])
        except (TypeError, ValueError):
            pass
    if "discount_type" in body and body["discount_type"] in ("percentage", "flat"):
        updates["discount_type"] = body["discount_type"]
    if "start_date" in body:
        try:
            updates["start_date"] = datetime.fromisoformat(body["start_date"]) if body["start_date"] else None
        except Exception:
            pass
    if "end_date" in body:
        try:
            updates["end_date"] = datetime.fromisoformat(body["end_date"]) if body["end_date"] else None
        except Exception:
            pass
    if "product_ids" in body and discount.get("scope") == "product":
        updates["product_ids"] = [_oid(pid) for pid in (body["product_ids"] or []) if _oid(pid)]
    if "category" in body and discount.get("scope") == "category":
        updates["category"] = (body["category"] or "").strip()

    db.discounts.update_one({"_id": oid}, {"$set": updates})
    return jsonify({"discount": _serialize_discount(db.discounts.find_one({"_id": oid}))})


@bp.route("/discounts/<discount_id>", methods=["DELETE"])
@require_permissions("discount.approve")
@jwt_required()
def delete_discount(discount_id: str):
    """Delete a discount."""
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503

    user_id = get_jwt_identity()
    if not db.users.find_one({"_id": _oid(user_id)}):
        return jsonify({"error": "user_not_found"}), 404

    oid = _oid(discount_id)
    if not oid:
        return jsonify({"error": "invalid_id"}), 400

    result = db.discounts.delete_one({"_id": oid})
    if not result.deleted_count:
        return jsonify({"error": "not_found"}), 404

    return jsonify({"message": "deleted"})
