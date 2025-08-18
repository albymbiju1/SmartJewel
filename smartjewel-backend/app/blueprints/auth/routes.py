from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from marshmallow import ValidationError
from app.extensions import limiter
from flask import current_app
from .schemas import LoginSchema, RegistrationSchema, StaffCreateSchema
from app.utils.security import verify_password, hash_password
from app.utils.authz import require_roles

bp = Blueprint("auth", __name__, url_prefix="/auth")
login_schema = LoginSchema()
registration_schema = RegistrationSchema()
staff_create_schema = StaffCreateSchema()

@limiter.limit("5 per minute")
@bp.post("/register")
def register():
    db = current_app.extensions['mongo_db']
    try:
        data = registration_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    existing = db.users.find_one({"email": data["email"].lower()})
    if existing:
        return jsonify({"error": "email_in_use"}), 409
    # Assign default role (customer) by looking up roles collection
    role_doc = db.roles.find_one({"role_name": "Customer"})
    if not role_doc:
        return jsonify({"error": "role_not_found"}), 500
    user_doc = {
        "full_name": data["name"],
        "email": data["email"].lower(),
        "phone_number": data["phone"],
        "password_hash": hash_password(data["password"]),
        "role": {
            "_id": role_doc["_id"],
            "role_name": role_doc["role_name"]
        },
        "status": "active",
        "created_at": db.command("isMaster")['localTime'] if 'localTime' in db.command("isMaster") else None
    }
    inserted = db.users.insert_one(user_doc)
    return jsonify({"id": str(inserted.inserted_id), "email": user_doc["email"], "full_name": user_doc["full_name"]}), 201


# Role -> default permissions (extend as system grows)
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "staff_l1": ["inventory.read"],
    "staff_l2": ["inventory.read", "inventory.update"],
    "staff_l3": ["inventory.read", "inventory.update", "inventory.export"],
    "customer": [],
}

def _expand_permissions(roles):
    perms = set()
    for r in roles:
        perms.update(ROLE_PERMISSIONS.get(r, []))
    return list(perms)

@limiter.limit("10 per minute")
@bp.post("/staff")
@require_roles("admin")
def create_staff():
    """Admin creates a staff member (level determines role)."""
    db = current_app.extensions['mongo_db']
    try:
        data = staff_create_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    email_l = data["email"].lower()
    if db.users.find_one({"email": email_l}):
        return jsonify({"error": "email_in_use"}), 409
    role = data["level"]
    roles = [role]
    perms = _expand_permissions(roles)
    user_doc = {
        "email": email_l,
        "name": data["name"],
        "password_hash": hash_password(data["password"]),
        "roles": roles,
        "permissions": perms,
        "is_active": True,
        "branch_id": data.get("branch_id"),
    }
    ins = db.users.insert_one(user_doc)
    return jsonify({"id": str(ins.inserted_id), "email": email_l, "roles": roles, "permissions": perms}), 201

@limiter.limit("10 per minute")
@bp.post("/login")
def login():
    db = current_app.extensions['mongo_db']
    try:
        data = login_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    user = db.users.find_one({"email": data["email"].lower(), "status": "active"})
    if not user or not verify_password(data["password"], user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    # Fetch full role info
    role_doc = db.roles.find_one({"_id": user["role"]["_id"]}) if user.get("role") else None
    identity = str(user["_id"])
    
    # Convert role info to JSON-serializable format
    role_info = {}
    if user.get("role"):
        role_info = {
            "_id": str(user["role"]["_id"]),
            "role_name": user["role"]["role_name"]
        }
    
    claims = {
        "role": role_info,
        "permissions": role_doc["permissions"] if role_doc else [],
        "email": user.get("email"),
        "full_name": user.get("full_name"),
    }
    access = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)

    safe_user = {
        "id": identity,
        "email": user["email"],
        "full_name": user.get("full_name"),
        "role": role_info,
        "permissions": role_doc["permissions"] if role_doc else [],
    }
    return jsonify({"access_token": access, "refresh_token": refresh, "user": safe_user}), 200

@bp.get("/me")
@jwt_required()
def me():
    claims = get_jwt()
    return jsonify({
        "user_id": get_jwt_identity(),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "roles": claims.get("roles", []),
        "branch_id": claims.get("branch_id"),
        "perms": claims.get("perms", []),
    }), 200

@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    claims = get_jwt()
    identity = claims["sub"]
    access = create_access_token(identity=identity, additional_claims={
        "roles": claims.get("roles", []),
        "perms": claims.get("perms", []),
        "branch_id": claims.get("branch_id"),
        "email": claims.get("email"),
        "name": claims.get("name"),
    })
    return jsonify({"access_token": access}), 200

@bp.post("/logout")
@jwt_required()
def logout():
    # Stateless JWT: client drops tokens
    return jsonify({"message": "logged_out"}), 200