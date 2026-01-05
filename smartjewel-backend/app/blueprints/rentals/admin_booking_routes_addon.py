"""
Admin Booking Management endpoints - appended to booking_routes.py
Handles pickup, return, payments, and admin booking management
"""

# Add these imports at the top if not already present
# from datetime import datetime, timedelta

# Helper function for admin access check
def _check_admin_access():
    """Check if current user has admin access."""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return False, jsonify({"error": "Authentication required"}), 401
        
        db = _db()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            return False, jsonify({"error": "User not found"}), 404
        
        # Check if user has admin or staff level 3 role
        role_name = user.get("role", {}).get("role_name", "")
        if role_name not in ["Admin", "Staff_L3"]:
            return False, jsonify({"error": "Insufficient permissions"}), 403
        
        return True, None, None
    except Exception as e:
        return False, jsonify({"error": str(e)}), 500


# ============ ADMIN BOOKING MANAGEMENT ENDPOINTS ============

@bp_bookings.get('/admin/bookings')
@jwt_required()
def admin_get_all_bookings():
    """
    Get all rental bookings (Admin)
    
    Query params:
    - status: Filter by booking_status
    - customer_id: Filter by customer
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20)
    - search: Search by product name or customer name
    """
    db = _db()
    
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    # Pagination
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))
    skip = (page - 1) * per_page
    
    # Build match query
    match_query = {}
    
    status_filter = request.args.get('status')
    if status_filter:
        match_query["booking_status"] = status_filter
    
    customer_id = request.args.get('customer_id')
    if customer_id:
        customer_oid = _validate_object_id(customer_id)
        if customer_oid:
            match_query["customer_id"] = customer_oid
    
    # Aggregate pipeline
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {"$sort": {"created_at": -1}},
        {
            "$lookup": {
                "from": "items",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "users",
                "localField": "customer_id",
                "foreignField": "_id",
                "as": "customer"
            }
        },
        {"$unwind": {"path": "$customer", "preserveNullAndEmptyArrays": True}},
    ]
    
    # Search filter
    search = request.args.get('search')
    if search:
        pipeline.append({
            "$match": {
                "$or": [
                    {"product.name": {"$regex": search, "$options": "i"}},
                    {"customer.full_name": {"$regex": search, "$options": "i"}},
                    {"customer.email": {"$regex": search, "$options": "i"}}
                ]
            }
        })
    
    # Pagination
    pipeline.append({
        "$facet": {
            "bookings": [
                {"$skip": skip},
                {"$limit": per_page}
            ],
            "total": [{"$count": "count"}]
        }
    })
    
    result = list(db.rental_bookings.aggregate(pipeline))
    bookings = result[0]["bookings"] if result else []
    total = result[0]["total"][0]["count"] if result and result[0]["total"] else 0
    
    # Convert ObjectIds
    for booking in bookings:
        booking["_id"] = str(booking["_id"])
        booking["rental_item_id"] = str(booking.get("rental_item_id", ""))
        booking["product_id"] = str(booking.get("product_id", ""))
        booking["customer_id"] = str(booking.get("customer_id", ""))
        if booking.get("product"):
            booking["product"]["_id"] = str(booking["product"]["_id"])
        if booking.get("customer"):
            booking["customer"]["_id"] = str(booking["customer"]["_id"])
            # Remove sensitive data
            booking["customer"].pop("password", None)
    
    return jsonify({
        "bookings": bookings,
        "page": page,
        "per_page": per_page,
        "total": total
    })


@bp_bookings.put('/admin/bookings/<booking_id>/pickup')
@jwt_required()
def admin_mark_pickup(booking_id):
    """
    Mark booking as picked up (Admin)
    
    Body:
    {
        "condition": "excellent" | "good" | "fair",
        "notes": "string (optional)"
    }
    """
    db = _db()
    
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Can only mark pickup if status is "confirmed"
    if booking["booking_status"] != "confirmed":
        return jsonify({"error": "Can only mark pickup for confirmed bookings"}), 400
    
    # Validate condition
    condition = data.get("condition")
    if condition not in ["excellent", "good", "fair"]:
        return jsonify({"error": "Invalid condition. Must be excellent, good, or fair"}), 400
    
    # Update booking
    db.rental_bookings.update_one(
        {"_id": booking_oid},
        {
            "$set": {
                "booking_status": "active",
                "actual_pickup_date": datetime.utcnow(),
                "pickup_staff_id": ObjectId(user_id),
                "condition_at_pickup": condition,
                "notes": data.get("notes", booking.get("notes", "")),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return jsonify({"message": "Booking marked as picked up successfully"})


@bp_bookings.put('/admin/bookings/<booking_id>/return')
@jwt_required()
def admin_mark_return(booking_id):
    """
    Mark booking as returned (Admin)
    
    Body:
    {
        "condition": "excellent" | "good" | "fair",
        "damage_notes": "string (optional)",
        "damage_charge": number (optional),
        "notes": "string (optional)"
    }
    """
    db = _db()
    
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Can only mark return if status is "active"
    if booking["booking_status"] != "active":
        return jsonify({"error": "Can only mark return for active bookings"}), 400
    
    # Validate condition
    condition = data.get("condition")
    if condition not in ["excellent", "good", "fair"]:
        return jsonify({"error": "Invalid condition. Must be excellent, good, or fair"}), 400
    
    # Calculate late fee if returned late
    actual_return_date = datetime.utcnow()
    expected_return_date = booking["end_date"]
    late_fee = 0
    
    if actual_return_date > expected_return_date:
        # Late by days
        late_days = (actual_return_date - expected_return_date).days
        # Charge 50% more per day for late return
        late_fee = late_days * booking["rental_price_per_day"] * 1.5
    
    # Damage charge
    damage_charge = float(data.get("damage_charge", 0))
    
    # Update booking
    update_data = {
        "booking_status": "completed",
        "actual_return_date": actual_return_date,
        "return_staff_id": ObjectId(user_id),
        "condition_at_return": condition,
        "damage_notes": data.get("damage_notes", ""),
        "damage_charge": damage_charge,
        "late_fee": late_fee,
        "total_amount": booking["total_rental_price"] + booking["security_deposit"] + late_fee + damage_charge,
        "notes": data.get("notes", booking.get("notes", "")),
        "updated_at": datetime.utcnow()
    }
    
    db.rental_bookings.update_one(
        {"_id": booking_oid},
        {"$set": update_data}
    )
    
    return jsonify({
        "message": "Booking marked as returned successfully",
        "late_fee": late_fee,
        "damage_charge": damage_charge,
        "total_charges": late_fee + damage_charge
    })


@bp_bookings.post('/bookings/<booking_id>/payments')
@jwt_required()
def record_payment(booking_id):
    """
    Record a payment for a booking (Admin)
    
    Body:
    {
        "payment_type": "rental_advance" | "security_deposit" | "balance" | "late_fee" | "damage_charge",
        "amount": number,
        "payment_method": "cash" | "card" | "upi" | "bank_transfer" | "razorpay",
        "transaction_ref": "string (optional)",
        "notes": "string (optional)"
    }
    """
    db = _db()
    
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Validate payment data
    payment_type = data.get("payment_type")
    amount = data.get("amount")
    payment_method = data.get("payment_method")
    
    if not all([payment_type, amount, payment_method]):
        return jsonify({"error": "payment_type, amount, and payment_method are required"}), 400
    
    if payment_type not in ["rental_advance", "security_deposit", "balance", "late_fee", "damage_charge"]:
        return jsonify({"error": "Invalid payment_type"}), 400
    
    if payment_method not in ["cash", "card", "upi", "bank_transfer", "razorpay"]:
        return jsonify({"error": "Invalid payment_method"}), 400
    
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400
    
    # Create payment record
    payment = {
        "booking_id": booking_oid,
        "customer_id": booking["customer_id"],
        "payment_type": payment_type,
        "amount": amount,
        "payment_method": payment_method,
        "payment_date": datetime.utcnow(),
        "transaction_ref": data.get("transaction_ref", ""),
        "received_by": ObjectId(user_id),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow()
    }
    
    db.rental_payments.insert_one(payment)
    
    # Update booking payment status
    new_amount_paid = booking.get("amount_paid", 0) + amount
    payment_status = "partial"
    
    if new_amount_paid >= booking["total_amount"]:
        payment_status = "paid"
    elif new_amount_paid > 0:
        payment_status = "partial"
    else:
        payment_status = "pending"
    
    db.rental_bookings.update_one(
        {"_id": booking_oid},
        {
            "$set": {
                "amount_paid": new_amount_paid,
                "payment_status": payment_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        "message": "Payment recorded successfully",
        "amount_paid": new_amount_paid,
        "payment_status": payment_status,
        "remaining": booking["total_amount"] - new_amount_paid
    }), 201


@bp_bookings.get('/bookings/<booking_id>/payments')
@jwt_required()
def get_payment_history(booking_id):
    """Get payment history for a booking"""
    db = _db()
    user_id = get_jwt_identity()
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Check access (customer or admin)
    user = db.users.find_one({"_id": ObjectId(user_id)})
    is_admin = user and user.get("role", {}).get("role_name") in ["Admin", "Staff_L3"]
    
    if str(booking["customer_id"]) != user_id and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # Get payments
    payments = list(db.rental_payments.find({"booking_id": booking_oid}).sort("created_at", -1))
    
    # Convert ObjectIds
    for payment in payments:
        payment["_id"] = str(payment["_id"])
        payment["booking_id"] = str(payment["booking_id"])
        payment["customer_id"] = str(payment["customer_id"])
        payment["received_by"] = str(payment.get("received_by", ""))
    
    return jsonify({"payments": payments})


@bp_bookings.put('/admin/bookings/<booking_id>/refund')
@jwt_required()
def process_refund(booking_id):
    """
    Process security deposit refund (Admin)
    
    Body:
    {
        "refund_amount": number,
        "refund_method": "cash" | "bank_transfer" | "razorpay",
        "transaction_ref": "string (optional)",
        "notes": "string (optional)"
    }
    """
    db = _db()
    
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Can only refund completed bookings
    if booking["booking_status"] != "completed":
        return jsonify({"error": "Can only refund completed bookings"}), 400
    
    if booking.get("deposit_refunded"):
        return jsonify({"error": "Deposit already refunded"}), 400
    
    # Validate refund data
    refund_amount = data.get("refund_amount")
    refund_method = data.get("refund_method")
    
    if not all([refund_amount, refund_method]):
        return jsonify({"error": "refund_amount and refund_method are required"}), 400
    
    try:
        refund_amount = float(refund_amount)
        if refund_amount <= 0:
            return jsonify({"error": "Refund amount must be positive"}), 400
    except ValueError:
        return jsonify({"error": "Invalid refund amount"}), 400
    
    # Record refund as negative payment
    payment = {
        "booking_id": booking_oid,
        "customer_id": booking["customer_id"],
        "payment_type": "deposit_refund",
        "amount": -refund_amount,  # Negative for refund
        "payment_method": refund_method,
        "payment_date": datetime.utcnow(),
        "transaction_ref": data.get("transaction_ref", ""),
        "received_by": ObjectId(user_id),
        "notes": data.get("notes", "Deposit refund"),
        "created_at": datetime.utcnow()
    }
    
    db.rental_payments.insert_one(payment)
    
    # Update booking
    db.rental_bookings.update_one(
        {"_id": booking_oid},
        {
            "$set": {
                "deposit_refunded": True,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        "message": "Deposit refunded successfully",
        "refund_amount": refund_amount
    })
