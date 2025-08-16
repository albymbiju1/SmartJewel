from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
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
    data = registration_schema.load(request.get_json() or {})
    existing = db.users.find_one({"email": data["email"].lower()})
    if existing:
        return jsonify({"error": "email_in_use"}), 409
    # Always assign base role 'customer'. Additional staff/admin roles managed internally.
    user_doc = {
        "email": data["email"].lower(),
        "name": data["name"],
        "password_hash": hash_password(data["password"]),
        "roles": ["customer"],
        "permissions": [],
        "is_active": True,
        "phone": data["phone"],
    }
    inserted = db.users.insert_one(user_doc)
    return jsonify({"id": str(inserted.inserted_id), "email": user_doc["email"], "name": user_doc["name"]}), 201


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
    data = staff_create_schema.load(request.get_json() or {})
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
    data = login_schema.load(request.get_json() or {})
    user = db.users.find_one({"email": data["email"].lower(), "is_active": True})
    if not user or not verify_password(data["password"], user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    identity = str(user["_id"])
    claims = {
        "roles": user.get("roles", []),
        "perms": user.get("permissions", []),
        "branch_id": user.get("branch_id"),
        "email": user.get("email"),
        "name": user.get("name"),
    }
    access = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)

    safe_user = {
        "id": identity,
        "email": user["email"],
        "name": user.get("name"),
        "roles": user.get("roles", []),
        "branch_id": user.get("branch_id"),
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