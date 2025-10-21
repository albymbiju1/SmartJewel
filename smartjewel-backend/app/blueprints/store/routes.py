from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.utils.authz import require_permissions
from bson import ObjectId
from marshmallow import Schema, fields, ValidationError
from datetime import datetime
import logging

log = logging.getLogger(__name__)
bp = Blueprint("stores", __name__, url_prefix="/stores")

# ---- Schemas ----
class StoreSchema(Schema):
    name = fields.String(required=True)
    location = fields.String(required=True)
    address = fields.String(required=True)
    phone = fields.String(required=True)
    email = fields.Email(required=True)
    manager = fields.String(required=True)
    latitude = fields.Float(required=False)
    longitude = fields.Float(required=False)
    opening_hours = fields.String(required=False)  # e.g., "10:00 AM - 8:00 PM"
    status = fields.String(validate=lambda v: v in ["active", "inactive"], required=False, load_default="active")

class StoreUpdateSchema(Schema):
    name = fields.String(required=False)
    location = fields.String(required=False)
    address = fields.String(required=False)
    phone = fields.String(required=False)
    email = fields.Email(required=False)
    manager = fields.String(required=False)
    latitude = fields.Float(required=False)
    longitude = fields.Float(required=False)
    opening_hours = fields.String(required=False)
    status = fields.String(validate=lambda v: v in ["active", "inactive"], required=False)

# ---- Helpers ----
def _oid(id_str: str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None

def _now(db):
    try:
        is_master = db.command("isMaster")
        return is_master.get("localTime")
    except Exception:
        return datetime.utcnow()

# ---- Store CRUD ----
@bp.get("")
def list_stores():
    """List all stores (public endpoint)"""
    db = current_app.extensions['mongo_db']
    
    try:
        stores = list(db.stores.find({"status": "active"}).sort("created_at", -1))
        
        store_list = []
        for store in stores:
            store_list.append({
                "id": str(store["_id"]),
                "name": store.get("name", ""),
                "location": store.get("location", ""),
                "address": store.get("address", ""),
                "phone": store.get("phone", ""),
                "email": store.get("email", ""),
                "manager": store.get("manager", ""),
                "latitude": store.get("latitude"),
                "longitude": store.get("longitude"),
                "opening_hours": store.get("opening_hours", ""),
                "status": store.get("status", "active"),
                "created_at": store.get("created_at"),
            })
        
        return jsonify({"stores": store_list}), 200
    except Exception as e:
        log.error(f"Error listing stores: {str(e)}")
        return jsonify({"error": "Failed to list stores"}), 500

@bp.post("")
@jwt_required()
@require_permissions("*")
def create_store():
    """Create a new store (admin only)"""
    db = current_app.extensions['mongo_db']
    
    log.info("create_store: Request received")
    try:
        schema = StoreSchema()
        data = schema.load(request.get_json())
        
        # Check if store with same name already exists
        existing = db.stores.find_one({"name": data["name"]})
        if existing:
            return jsonify({"error": "Store with this name already exists"}), 409
        
        store_doc = {
            **data,
            "created_at": _now(db),
            "updated_at": _now(db),
        }
        
        result = db.stores.insert_one(store_doc)
        
        return jsonify({
            "id": str(result.inserted_id),
            "message": "Store created successfully"
        }), 201
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.messages}), 400
    except Exception as e:
        log.error(f"Error creating store: {str(e)}")
        return jsonify({"error": "Failed to create store"}), 500

@bp.get("/<store_id>")
def get_store(store_id):
    """Get store details (public endpoint)"""
    db = current_app.extensions['mongo_db']
    
    try:
        store_oid = _oid(store_id)
        if not store_oid:
            return jsonify({"error": "Invalid store ID"}), 400
        
        store = db.stores.find_one({"_id": store_oid})
        if not store:
            return jsonify({"error": "Store not found"}), 404
        
        return jsonify({
            "id": str(store["_id"]),
            "name": store.get("name", ""),
            "location": store.get("location", ""),
            "address": store.get("address", ""),
            "phone": store.get("phone", ""),
            "email": store.get("email", ""),
            "manager": store.get("manager", ""),
            "latitude": store.get("latitude"),
            "longitude": store.get("longitude"),
            "opening_hours": store.get("opening_hours", ""),
            "status": store.get("status", "active"),
            "created_at": store.get("created_at"),
            "updated_at": store.get("updated_at"),
        }), 200
    except Exception as e:
        log.error(f"Error getting store: {str(e)}")
        return jsonify({"error": "Failed to get store"}), 500

@bp.patch("/<store_id>")
@jwt_required()
@require_permissions("*")
def update_store(store_id):
    """Update store details (admin only)"""
    db = current_app.extensions['mongo_db']
    
    try:
        store_oid = _oid(store_id)
        if not store_oid:
            return jsonify({"error": "Invalid store ID"}), 400
        
        schema = StoreUpdateSchema()
        data = schema.load(request.get_json())
        
        # Check if store exists
        store = db.stores.find_one({"_id": store_oid})
        if not store:
            return jsonify({"error": "Store not found"}), 404
        
        # If updating name, check if it's already taken
        if "name" in data and data["name"] != store.get("name"):
            existing = db.stores.find_one({"name": data["name"]})
            if existing:
                return jsonify({"error": "Store with this name already exists"}), 409
        
        data["updated_at"] = _now(db)
        
        result = db.stores.update_one(
            {"_id": store_oid},
            {"$set": data}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Store not found"}), 404
        
        return jsonify({"message": "Store updated successfully"}), 200
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.messages}), 400
    except Exception as e:
        log.error(f"Error updating store: {str(e)}")
        return jsonify({"error": "Failed to update store"}), 500

@bp.delete("/<store_id>")
@jwt_required()
@require_permissions("*")
def delete_store(store_id):
    """Delete a store (admin only)"""
    db = current_app.extensions['mongo_db']
    
    try:
        store_oid = _oid(store_id)
        if not store_oid:
            return jsonify({"error": "Invalid store ID"}), 400
        
        result = db.stores.delete_one({"_id": store_oid})
        
        if result.deleted_count == 0:
            return jsonify({"error": "Store not found"}), 404
        
        return jsonify({"message": "Store deleted successfully"}), 200
    except Exception as e:
        log.error(f"Error deleting store: {str(e)}")
        return jsonify({"error": "Failed to delete store"}), 500

# ---- Appointment Booking (Future Integration) ----
@bp.post("/<store_id>/book-appointment")
def book_appointment(store_id):
    """Book an appointment at a store (public endpoint)"""
    db = current_app.extensions['mongo_db']
    
    try:
        store_oid = _oid(store_id)
        if not store_oid:
            return jsonify({"error": "Invalid store ID"}), 400
        
        # Validate store exists
        store = db.stores.find_one({"_id": store_oid, "status": "active"})
        if not store:
            return jsonify({"error": "Store not found"}), 404
        
        # Get appointment data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["customer_name", "customer_email", "customer_phone", "preferred_date", "preferred_time"]
        missing_fields = [f for f in required_fields if not data.get(f)]
        if missing_fields:
            return jsonify({
                "error": "Missing required fields",
                "missing": missing_fields
            }), 400
        
        # Create appointment record
        appointment = {
            "store_id": store_oid,
            "store_name": store.get("name"),
            "customer_name": data.get("customer_name"),
            "customer_email": data.get("customer_email"),
            "customer_phone": data.get("customer_phone"),
            "preferred_date": data.get("preferred_date"),
            "preferred_time": data.get("preferred_time"),
            "notes": data.get("notes", ""),
            "status": "pending",
            "created_at": _now(db),
        }
        
        result = db.appointments.insert_one(appointment)
        
        return jsonify({
            "id": str(result.inserted_id),
            "message": "Appointment request submitted successfully",
            "status": "pending"
        }), 201
    except Exception as e:
        log.error(f"Error booking appointment: {str(e)}")
        return jsonify({"error": "Failed to book appointment"}), 500