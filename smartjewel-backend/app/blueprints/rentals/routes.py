from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

bp = Blueprint("rentals", __name__, url_prefix="/api/rentals")


def _db():
    return current_app.extensions['mongo_db']


@bp.get('')
def get_rentals():
    """Get all available rental jewellery.
    
    Query params:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 60)
    - category: Filter by category
    - min_price: Minimum rental price per day
    - max_price: Maximum rental price per day
    """
    db = _db()
    
    # Parse pagination params
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(60, max(1, int(request.args.get('per_page', 20))))
    skip = (page - 1) * per_page
    
    # Build aggregation pipeline
    pipeline = [
        # Match only available rental items
        {"$match": {"status": "available"}},
    ]
    
    # Apply filters
    category = request.args.get('category')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    
    # Add price filter for rental_price_per_day
    price_match = {}
    if min_price:
        price_match["$gte"] = float(min_price)
    if max_price:
        price_match["$lte"] = float(max_price)
    if price_match:
        pipeline.append({"$match": {"rental_price_per_day": price_match}})
    
    # Lookup product details from items collection
    pipeline.extend([
        {
            "$lookup": {
                "from": "items",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": "$product"},
        # Filter products that are rentable and active
        {"$match": {"product.isRentable": True, "product.status": "active"}},
    ])
    
    # Apply category filter if provided
    if category:
        pipeline.append({"$match": {"product.category": {"$regex": category, "$options": "i"}}})
    
    # Add facet for pagination
    pipeline.append({
        "$facet": {
            "results": [
                {"$skip": skip},
                {"$limit": per_page},
                {
                    "$project": {
                        "_id": 1,
                        "rental_price_per_day": 1,
                        "security_deposit": 1,
                        "status": 1,
                        "product_id": 1,
                        "product.name": 1,
                        "product.category": 1,
                        "product.image": 1,
                        "product.metal": 1,
                        "product.purity": 1,
                    }
                }
            ],
            "total": [{"$count": "count"}]
        }
    })
    
    result = list(db.rental_items.aggregate(pipeline))
    
    if not result:
        return jsonify({
            "results": [],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": 0,
                "total_pages": 0
            }
        })
    
    results = result[0]["results"]
    total = result[0]["total"][0]["count"] if result[0]["total"] else 0
    
    # Convert ObjectIds to strings
    for item in results:
        item["_id"] = str(item["_id"])
        item["product_id"] = str(item["product_id"])
    
    return jsonify({
        "results": results,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    })


@bp.get('/<rental_item_id>')
def get_rental_detail(rental_item_id):
    """Get detailed information about a specific rental item.
    
    Args:
        rental_item_id: The ID of the rental item
    """
    db = _db()
    
    try:
        rental_id = ObjectId(rental_item_id)
    except Exception:
        return jsonify({"error": "Invalid rental item ID"}), 400
    
    # Aggregate to get rental item with product details
    pipeline = [
        {"$match": {"_id": rental_id}},
        {
            "$lookup": {
                "from": "items",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": "$product"},
        {
            "$project": {
                "_id": 1,
                "product_id": 1,
                "rental_price_per_day": 1,
                "security_deposit": 1,
                "status": 1,
                "product": 1
            }
        }
    ]
    
    result = list(db.rental_items.aggregate(pipeline))
    
    if not result:
        return jsonify({"error": "Rental item not found"}), 404
    
    rental_item = result[0]
    
    # Convert ObjectIds to strings
    rental_item["_id"] = str(rental_item["_id"])
    rental_item["product_id"] = str(rental_item["product_id"])
    
    # Convert product._id to string
    if "product" in rental_item and "_id" in rental_item["product"]:
        rental_item["product"]["_id"] = str(rental_item["product"]["_id"])
    
    # Also convert any nested ObjectIds in product
    if "product" in rental_item:
        for key, value in rental_item["product"].items():
            if isinstance(value, ObjectId):
                rental_item["product"][key] = str(value)
    
    return jsonify(rental_item)


# ============================================================================
# ADMIN ENDPOINTS - Rental Management
# ============================================================================

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


@bp.get('/admin/all')
@jwt_required()
def admin_get_all_rentals():
    """Get all rental items (admin only).
    
    Query params:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    - status: Filter by status (available/rented/maintenance)
    - search: Search by product name
    """
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    db = _db()
    
    # Parse pagination params
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    skip = (page - 1) * per_page
    
    # Build aggregation pipeline
    pipeline = []
    
    # Filter by status if provided
    status_filter = request.args.get('status')
    if status_filter:
        pipeline.append({"$match": {"status": status_filter}})
    
    # Lookup product details
    pipeline.extend([
        {
            "$lookup": {
                "from": "items",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": "$product"},
    ])
    
    # Search by product name if provided
    search_query = request.args.get('search')
    if search_query:
        pipeline.append({
            "$match": {
                "product.name": {"$regex": search_query, "$options": "i"}
            }
        })
    
    # Add facet for pagination
    pipeline.append({
        "$facet": {
            "results": [
                {"$skip": skip},
                {"$limit": per_page},
                {
                    "$project": {
                        "_id": 1,
                        "product_id": 1,
                        "rental_price_per_day": 1,
                        "security_deposit": 1,
                        "status": 1,
                        "created_at": 1,
                        "product.name": 1,
                        "product.category": 1,
                        "product.image": 1,
                        "product.metal": 1,
                        "product.purity": 1,
                        "product.isRentable": 1,
                    }
                }
            ],
            "total": [{"$count": "count"}]
        }
    })
    
    result = list(db.rental_items.aggregate(pipeline))
    
    if not result:
        return jsonify({
            "results": [],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": 0,
                "total_pages": 0
            }
        })
    
    results = result[0]["results"]
    total = result[0]["total"][0]["count"] if result[0]["total"] else 0
    
    # Convert ObjectIds to strings
    for item in results:
        item["_id"] = str(item["_id"])
        item["product_id"] = str(item["product_id"])
    
    return jsonify({
        "results": results,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    })


@bp.post('/admin')
@jwt_required()
def admin_create_rental():
    """Create a new rental item (admin only).
    
    Request body:
    - product_id: ID of the product
    - rental_price_per_day: Rental price per day
    - security_deposit: Security deposit amount
    """
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    db = _db()
    data = request.get_json() or {}
    
    # Validate required fields
    product_id = data.get('product_id')
    rental_price = data.get('rental_price_per_day')
    security_deposit = data.get('security_deposit')
    
    if not all([product_id, rental_price, security_deposit]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Validate pricing
    try:
        rental_price = float(rental_price)
        security_deposit = float(security_deposit)
        
        if rental_price <= 0 or security_deposit <= 0:
            return jsonify({"error": "Prices must be greater than 0"}), 400
    except ValueError:
        return jsonify({"error": "Invalid price format"}), 400
    
    # Validate product exists
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({"error": "Invalid product ID"}), 400
    
    product = db.items.find_one({"_id": product_obj_id})
    if not product:
        return jsonify({"error": "Product not found"}), 404
    
    # Check if rental item already exists for this product
    existing_rental = db.rental_items.find_one({"product_id": product_obj_id})
    if existing_rental:
        return jsonify({"error": "Rental item already exists for this product"}), 409
    
    # Create rental item
    from datetime import datetime
    rental_item = {
        "product_id": product_obj_id,
        "rental_price_per_day": rental_price,
        "security_deposit": security_deposit,
        "status": "available",
        "created_at": datetime.utcnow()
    }
    
    result = db.rental_items.insert_one(rental_item)
    
    # Update product to mark as rentable
    db.items.update_one(
        {"_id": product_obj_id},
        {"$set": {"isRentable": True}}
    )
    
    # Return created rental item
    rental_item["_id"] = str(result.inserted_id)
    rental_item["product_id"] = str(rental_item["product_id"])
    
    return jsonify(rental_item), 201


@bp.put('/admin/<rental_item_id>')
@jwt_required()
def admin_update_rental(rental_item_id):
    """Update a rental item (admin only).
    
    Request body:
    - rental_price_per_day: (optional) New rental price per day
    - security_deposit: (optional) New security deposit
    - status: (optional) New status (available/rented/maintenance)
    """
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    db = _db()
    data = request.get_json() or {}
    
    # Validate rental item ID
    try:
        rental_id = ObjectId(rental_item_id)
    except Exception:
        return jsonify({"error": "Invalid rental item ID"}), 400
    
    # Check if rental item exists
    rental_item = db.rental_items.find_one({"_id": rental_id})
    if not rental_item:
        return jsonify({"error": "Rental item not found"}), 404
    
    # Build update document
    update_data = {}
    
    if "rental_price_per_day" in data:
        try:
            price = float(data["rental_price_per_day"])
            if price <= 0:
                return jsonify({"error": "Rental price must be greater than 0"}), 400
            update_data["rental_price_per_day"] = price
        except ValueError:
            return jsonify({"error": "Invalid rental price format"}), 400
    
    if "security_deposit" in data:
        try:
            deposit = float(data["security_deposit"])
            if deposit <= 0:
                return jsonify({"error": "Security deposit must be greater than 0"}), 400
            update_data["security_deposit"] = deposit
        except ValueError:
            return jsonify({"error": "Invalid security deposit format"}), 400
    
    if "status" in data:
        status = data["status"]
        if status not in ["available", "rented", "maintenance"]:
            return jsonify({"error": "Invalid status"}), 400
        update_data["status"] = status
    
    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400
    
    # Update rental item
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()
    
    db.rental_items.update_one(
        {"_id": rental_id},
        {"$set": update_data}
    )
    
    # Get updated rental item
    updated_rental = db.rental_items.find_one({"_id": rental_id})
    updated_rental["_id"] = str(updated_rental["_id"])
    updated_rental["product_id"] = str(updated_rental["product_id"])
    
    return jsonify(updated_rental)


@bp.delete('/admin/<rental_item_id>')
@jwt_required()
def admin_delete_rental(rental_item_id):
    """Delete a rental item (admin only).
    
    Query params:
    - unmark_rentable: If true, also set product.isRentable to false (default: false)
    """
    # Check admin access
    has_access, error_response, status_code = _check_admin_access()
    if not has_access:
        return error_response, status_code
    
    db = _db()
    
    # Validate rental item ID
    try:
        rental_id = ObjectId(rental_item_id)
    except Exception:
        return jsonify({"error": "Invalid rental item ID"}), 400
    
    # Check if rental item exists
    rental_item = db.rental_items.find_one({"_id": rental_id})
    if not rental_item:
        return jsonify({"error": "Rental item not found"}), 404
    
    # Delete rental item
    db.rental_items.delete_one({"_id": rental_id})
    
    # Optionally unmark product as rentable
    unmark_rentable = request.args.get('unmark_rentable', 'false').lower() == 'true'
    if unmark_rentable:
        db.items.update_one(
            {"_id": rental_item["product_id"]},
            {"$set": {"isRentable": False}}
        )
    
    return jsonify({"message": "Rental item deleted successfully"}), 200

