from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime


print("LOADING NOTIFICATION BLUEPRINT")
bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.route("/debug", methods=["GET"])
def debug_notifications():
    """Debug endpoint to check notifications in database."""
    db = current_app.extensions['mongo_db']

    try:
        # Count total notifications
        total = db.notifications.count_documents({})

        # Get latest 10 notifications (any user)
        recent = list(db.notifications.find().sort("created_at", -1).limit(10))

        # Convert to serializable format
        for n in recent:
            n["_id"] = str(n["_id"])
            n["user_id"] = str(n["user_id"]) if n.get("user_id") else None
            if n.get("created_at"):
                n["created_at"] = str(n["created_at"])

        return jsonify({
            "total_notifications": total,
            "recent_notifications": recent,
            "collection_name": "notifications"
        }), 200
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

@bp.before_request
def log_request_info():
    print(f"[Notifications] Request to {request.path}")
    auth = request.headers.get('Authorization')
    print(f"[Notifications] Auth Header: {auth[:20]}..." if auth else "[Notifications] No Auth Header")
    if request.method == "OPTIONS":
        return


@bp.route("/", methods=["GET", "OPTIONS"])
@jwt_required(optional=True)  # Allow both authenticated and unauthenticated requests
def get_notifications():
    if request.method == "OPTIONS":
        return "", 204

    """Get all notifications for the current user."""
    identity = get_jwt_identity()

    # If not authenticated, return empty notifications instead of error
    if not identity:
        print("[Notifications] No identity found - returning empty list")
        return jsonify({"notifications": []}), 200

    db = current_app.extensions.get('mongo_db')
    if db is None:
        print("[Notifications] ERROR: Database connection not available")
        return jsonify({"notifications": [], "error": "database_unavailable"}), 200

    user_id = identity

    print(f"[Notifications] Fetching for user_id: {user_id} (type: {type(user_id).__name__})")

    try:
        # Try to convert to ObjectId
        try:
            user_oid = ObjectId(user_id)
        except Exception as e:
            print(f"[Notifications] Failed to convert user_id to ObjectId: {e}")
            return jsonify({"notifications": [], "debug": f"invalid_user_id: {user_id}"}), 200

        # Fetch notifications for the user, sort by newest first
        # Try both ObjectId and string match for user_id
        notifications = list(db.notifications.find(
            {"$or": [{"user_id": user_oid}, {"user_id": str(user_id)}]}
        ).sort("created_at", -1).limit(50))

        print(f"[Notifications] Found {len(notifications)} notifications for user {user_id}")

        # Convert ObjectIds to strings
        for n in notifications:
            n["_id"] = str(n["_id"])
            if isinstance(n.get("user_id"), ObjectId):
                n["user_id"] = str(n["user_id"])
            if n.get("created_at"):
                n["created_at"] = n["created_at"].isoformat()

        return jsonify({"notifications": notifications}), 200

    except Exception as e:
        print(f"Error fetching notifications: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "failed_to_fetch_notifications"}), 500

@bp.route("/<notification_id>/read", methods=["POST", "OPTIONS"])
@jwt_required(optional=True)
def mark_as_read(notification_id):
    if request.method == "OPTIONS":
        return "", 204
    
    identity = get_jwt_identity()
    if not identity:
        return jsonify({"error": "authentication_required"}), 401
    
    """Mark a single notification as read."""
    db = current_app.extensions['mongo_db']
    user_id = identity

    try:
        # Try to convert to ObjectId
        try:
            user_oid = ObjectId(user_id)
            notif_oid = ObjectId(notification_id)
        except Exception as e:
            print(f"[Notifications] Invalid ID format: {e}")
            return jsonify({"error": "invalid_id_format"}), 400

        # Match both ObjectId and string user_id for compatibility
        result = db.notifications.update_one(
            {
                "_id": notif_oid,
                "$or": [{"user_id": user_oid}, {"user_id": str(user_id)}]
            },
            {"$set": {"is_read": True}}
        )

        if result.matched_count == 0:
            return jsonify({"error": "notification_not_found"}), 404

        return jsonify({"success": True}), 200

    except Exception as e:
        print(f"Error marking notification as read: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "failed_to_mark_read"}), 500

@bp.route("/read-all", methods=["POST", "OPTIONS"])
@jwt_required(optional=True)
def mark_all_as_read():
    if request.method == "OPTIONS":
        return "", 204

    identity = get_jwt_identity()
    if not identity:
        return jsonify({"error": "authentication_required"}), 401

    """Mark all notifications for the user as read."""
    db = current_app.extensions['mongo_db']
    user_id = identity

    try:
        # Try to convert to ObjectId
        try:
            user_oid = ObjectId(user_id)
        except Exception as e:
            print(f"[Notifications] Invalid user_id format: {e}")
            return jsonify({"error": "invalid_user_id"}), 400

        # Match both ObjectId and string user_id for compatibility
        db.notifications.update_many(
            {
                "$or": [{"user_id": user_oid}, {"user_id": str(user_id)}],
                "is_read": False
            },
            {"$set": {"is_read": True}}
        )

        return jsonify({"success": True}), 200

    except Exception as e:
        print(f"Error marking all notifications as read: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "failed_to_mark_all_read"}), 500


@bp.route("/clear-all", methods=["DELETE", "OPTIONS"])
@jwt_required(optional=True)
def clear_all_notifications():
    if request.method == "OPTIONS":
        return "", 204

    identity = get_jwt_identity()
    if not identity:
        return jsonify({"error": "authentication_required"}), 401

    """Delete all notifications for the user."""
    db = current_app.extensions['mongo_db']
    user_id = identity

    try:
        # Try to convert to ObjectId
        try:
            user_oid = ObjectId(user_id)
        except Exception as e:
            print(f"[Notifications] Invalid user_id format: {e}")
            return jsonify({"error": "invalid_user_id"}), 400

        # Delete notifications matching both ObjectId and string user_id
        result = db.notifications.delete_many(
            {"$or": [{"user_id": user_oid}, {"user_id": str(user_id)}]}
        )

        print(f"[Notifications] Cleared {result.deleted_count} notifications for user {user_id}")
        return jsonify({"success": True, "deleted_count": result.deleted_count}), 200

    except Exception as e:
        print(f"Error clearing notifications: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "failed_to_clear_notifications"}), 500
