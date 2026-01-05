"""
Rental Booking APIs - Customer and Admin Endpoints
Handles date-based rental bookings, payments, and availability
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta

bp_bookings = Blueprint("rental_bookings", __name__, url_prefix="/api/rentals")


def _db():
    return current_app.extensions['mongo_db']


def _validate_object_id(id_string, field_name="id"):
    """Validate and convert string to ObjectId"""
    try:
        return ObjectId(id_string)
    except:
        return None


def _check_date_conflicts(db, rental_item_id, start_date, end_date, exclude_booking_id=None):
    """
    Check if there are any booking conflicts for the given rental item and date range.
    Returns (has_conflict, conflicting_bookings)
    """
    rental_item_oid = _validate_object_id(rental_item_id)
    if not rental_item_oid:
        return True, []
    
    # Query for overlapping bookings
    query = {
        "rental_item_id": rental_item_oid,
        "booking_status": {"$in": ["confirmed", "active"]},  # Only check active bookings
        "$or": [
            # Start date falls within existing booking
            {"$and": [{"start_date": {"$lte": start_date}}, {"end_date": {"$gte": start_date}}]},
            # End date falls within existing booking
            {"$and": [{"start_date": {"$lte": end_date}}, {"end_date": {"$gte": end_date}}]},
            # New booking completely encompasses existing booking
            {"$and": [{"start_date": {"$gte": start_date}}, {"end_date": {"$lte": end_date}}]}
        ]
    }
    
    # Exclude current booking if editing
    if exclude_booking_id:
        exclude_oid = _validate_object_id(exclude_booking_id)
        if exclude_oid:
            query["_id"] = {"$ne": exclude_oid}
    
    conflicting = list(db.rental_bookings.find(query).limit(5))
    return len(conflicting) > 0, conflicting


# ============ CUSTOMER BOOKING ENDPOINTS ============

@bp_bookings.post('/bookings')
@jwt_required()
def create_booking():
    """
    Create a new rental booking (Customer)
    
    Body:
    {
        "rental_item_id": "string",
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "notes": "string (optional)"
    }
    """
    db = _db()
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    # Validate required fields
    rental_item_id = data.get('rental_item_id')
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')
    
    if not all([rental_item_id, start_date_str, end_date_str]):
        return jsonify({"error": "rental_item_id, start_date, and end_date are required"}), 400
    
    # Validate rental item
    rental_item_oid = _validate_object_id(rental_item_id)
    if not rental_item_oid:
        return jsonify({"error": "Invalid rental_item_id"}), 400
    
    rental_item = db.rental_items.find_one({"_id": rental_item_oid})
    if not rental_item:
        return jsonify({"error": "Rental item not found"}), 404
    
    if rental_item.get("status") != "available":
        return jsonify({"error": "Rental item is not available"}), 400
    
    # Parse and validate dates
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    # Validate date logic
    if start_date >= end_date:
        return jsonify({"error": "End date must be after start date"}), 400
    
    if start_date < datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0):
        return jsonify({"error": "Start date cannot be in the past"}), 400
    
    # Calculate duration
    duration_days = (end_date - start_date).days + 1
    
    # Check min/max rental days
    min_days = rental_item.get("min_rental_days", 1)
    max_days = rental_item.get("max_rental_days", 30)
    
    if duration_days < min_days:
        return jsonify({"error": f"Minimum rental period is {min_days} days"}), 400
    
    if duration_days > max_days:
        return jsonify({"error": f"Maximum rental period is {max_days} days"}), 400
    
    # Check advance booking limit
    advance_days = rental_item.get("advance_booking_days", 90)
    max_future_date = datetime.utcnow() + timedelta(days=advance_days)
    if start_date > max_future_date:
        return jsonify({"error": f"Cannot book more than {advance_days} days in advance"}), 400
    
    # Check for date conflicts
    has_conflict, conflicts = _check_date_conflicts(db, rental_item_id, start_date, end_date)
    if has_conflict:
        return jsonify({
            "error": "Rental item not available for selected dates",
            "conflicts": [{"start": c["start_date"].isoformat(), "end": c["end_date"].isoformat()} for c in conflicts]
        }), 409
    
    # Calculate pricing
    rental_price_per_day = rental_item.get("rental_price_per_day", 0)
    security_deposit = rental_item.get("security_deposit", 0)
    total_rental_price = rental_price_per_day * duration_days
    total_amount = total_rental_price + security_deposit
    
    # Create booking
    booking = {
        "rental_item_id": rental_item_oid,
        "product_id": rental_item.get("product_id"),
        "customer_id": ObjectId(user_id),
        
        # Dates
        "start_date": start_date,
        "end_date": end_date,
        "duration_days": duration_days,
        
        # Pricing
        "rental_price_per_day": rental_price_per_day,
        "total_rental_price": total_rental_price,
        "security_deposit": security_deposit,
        "late_fee": 0,
        "total_amount": total_amount,
        
        # Payment
        "payment_status": "pending",
        "amount_paid": 0,
        "deposit_refunded": False,
        
        # Status
        "booking_status": "confirmed",
        
        # Handover
        "actual_pickup_date": None,
        "actual_return_date": None,
        "pickup_staff_id": None,
        "return_staff_id": None,
        
        # Condition
        "condition_at_pickup": None,
        "condition_at_return": None,
        "damage_notes": None,
        "damage_charge": 0,
        
        # Metadata
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": ObjectId(user_id),
        "cancelled_at": None,
        "cancelled_by": None,
        "cancellation_reason": None
    }
    
    result = db.rental_bookings.insert_one(booking)
    booking["_id"] = str(result.inserted_id)
    booking["rental_item_id"] = str(booking["rental_item_id"])
    booking["product_id"] = str(booking["product_id"])
    booking["customer_id"] = str(booking["customer_id"])
    booking["created_by"] = str(booking["created_by"])
    
    return jsonify({
        "message": "Booking created successfully",
        "booking": booking
    }), 201


@bp_bookings.get('/bookings')
@jwt_required()
def get_customer_bookings():
    """
    Get customer's rental bookings
    
    Query params:
    - status: Filter by booking_status
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20)
    """
    db = _db()
    user_id = get_jwt_identity()
    
    # Pagination
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))
    skip = (page - 1) * per_page
    
    # Build query
    query = {"customer_id": ObjectId(user_id)}
    
    status_filter = request.args.get('status')
    if status_filter:
        query["booking_status"] = status_filter
    
    # Aggregate with rental item and product details
    pipeline = [
        {"$match": query},
        {"$sort": {"created_at": -1}},
        {
            "$lookup": {
                "from": "rental_items",
                "localField": "rental_item_id",
                "foreignField": "_id",
                "as": "rental_item"
            }
        },
        {"$unwind": {"path": "$rental_item", "preserveNullAndEmptyArrays": True}},
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
            "$facet": {
                "bookings": [
                    {"$skip": skip},
                    {"$limit": per_page}
                ],
                "total": [{"$count": "count"}]
            }
        }
    ]
    
    result = list(db.rental_bookings.aggregate(pipeline))
    bookings = result[0]["bookings"] if result else []
    total = result[0]["total"][0]["count"] if result and result[0]["total"] else 0
    
    # Helper function to convert all ObjectIds recursively
    def convert_objectids(obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, dict):
            return {key: convert_objectids(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [convert_objectids(item) for item in obj]
        else:
            return obj
    
    # Convert all ObjectIds in bookings
    bookings = convert_objectids(bookings)
    
    return jsonify({
        "bookings": bookings,
        "page": page,
        "per_page": per_page,
        "total": total
    })


@bp_bookings.get('/bookings/<booking_id>')
@jwt_required()
def get_booking_details(booking_id):
    """Get booking details by ID"""
    db = _db()
    user_id = get_jwt_identity()
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    # Aggregate with product details
    pipeline = [
        {"$match": {"_id": booking_oid}},
        {
            "$lookup": {
                "from": "rental_items",
                "localField": "rental_item_id",
                "foreignField": "_id",
                "as": "rental_item"
            }
        },
        {"$unwind": {"path": "$rental_item", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "items",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}},
    ]
    
    result = list(db.rental_bookings.aggregate(pipeline))
    if not result:
        return jsonify({"error": "Booking not found"}), 404
    
    booking = result[0]
    
    # Check if user owns this booking (or is admin)
    user = db.users.find_one({"_id": ObjectId(user_id)})
    is_admin = user and user.get("role", {}).get("role_name") in ["Admin", "Staff_L3"]
    
    if str(booking["customer_id"]) != user_id and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # Convert ObjectIds
    booking["_id"] = str(booking["_id"])
    booking["rental_item_id"] = str(booking.get("rental_item_id", ""))
    booking["product_id"] = str(booking.get("product_id", ""))
    booking["customer_id"] = str(booking.get("customer_id", ""))
    if booking.get("product"):
        booking["product"]["_id"] = str(booking["product"]["_id"])
    
    # Helper function to convert all ObjectIds recursively
    def convert_objectids(obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, dict):
            return {key: convert_objectids(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [convert_objectids(item) for item in obj]
        else:
            return obj
    
    # Convert ObjectIds
    booking = convert_objectids(booking)
    
    return jsonify({"booking": booking})


@bp_bookings.put('/bookings/<booking_id>/cancel')
@jwt_required()
def cancel_booking(booking_id):
    """Cancel a booking (only if not yet active)"""
    db = _db()
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    booking_oid = _validate_object_id(booking_id)
    if not booking_oid:
        return jsonify({"error": "Invalid booking ID"}), 400
    
    booking = db.rental_bookings.find_one({"_id": booking_oid})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    
    # Check ownership
    if str(booking["customer_id"]) != user_id:
        return jsonify({"error": "Access denied"}), 403
    
    # Can only cancel if status is "confirmed" (not yet picked up)
    if booking["booking_status"] not in ["confirmed"]:
        return jsonify({"error": "Can only cancel confirmed bookings that haven't been picked up"}), 400
    
    # Update booking
    db.rental_bookings.update_one(
        {"_id": booking_oid},
        {
            "$set": {
                "booking_status": "cancelled",
                "cancelled_at": datetime.utcnow(),
                "cancelled_by": ObjectId(user_id),
                "cancellation_reason": data.get("reason", "Customer cancelled"),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return jsonify({"message": "Booking cancelled successfully"})


@bp_bookings.get('/availability/<rental_item_id>')
def check_availability(rental_item_id):
    """
    Check availability for a rental item
    
    Query params:
    - start_date: YYYY-MM-DD (optional, defaults to today)
    - end_date: YYYY-MM-DD (optional, defaults to 90 days from start)
    
    Returns list of booked date ranges
    """
    db = _db()
    
    rental_item_oid = _validate_object_id(rental_item_id)
    if not rental_item_oid:
        return jsonify({"error": "Invalid rental_item_id"}), 400
    
    # Parse date range
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    
    try:
        if start_str:
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
        else:
            start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        if end_str:
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
        else:
            end_date = start_date + timedelta(days=90)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    # Get all bookings in date range
    bookings = list(db.rental_bookings.find({
        "rental_item_id": rental_item_oid,
        "booking_status": {"$in": ["confirmed", "active"]},
        "$or": [
            {"start_date": {"$lte": end_date}},
            {"end_date": {"$gte": start_date}}
        ]
    }).sort("start_date", 1))
    
    # Format blocked dates
    blocked_dates = []
    for booking in bookings:
        blocked_dates.append({
            "start": booking["start_date"].strftime("%Y-%m-%d"),
            "end": booking["end_date"].strftime("%Y-%m-%d"),
            "booking_id": str(booking["_id"])
        })
    
    return jsonify({
        "rental_item_id": rental_item_id,
        "blocked_dates": blocked_dates,
        "query_range": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d")
        }
    })
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
