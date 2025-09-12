from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.utils.authz import require_permissions
from bson import ObjectId
from marshmallow import Schema, fields, ValidationError
from datetime import datetime

bp = Blueprint("staff", __name__, url_prefix="/api")

# ---- Schemas ----
class StaffSchema(Schema):
    full_name = fields.String(required=True)
    email = fields.Email(required=True)
    phone_number = fields.String(required=False, allow_none=True)
    role_id = fields.String(required=True)
    status = fields.String(validate=lambda v: v in ["active", "inactive"], required=False)

class StaffUpdateSchema(Schema):
    full_name = fields.String(required=False)
    phone_number = fields.String(required=False)
    role_id = fields.String(required=False)
    status = fields.String(validate=lambda v: v in ["active", "inactive"], required=False)

class RoleSchema(Schema):
    role_name = fields.String(required=True)
    permissions = fields.List(fields.String(), required=True)

class RolePermsSchema(Schema):
    permissions = fields.List(fields.String(), required=True)

class ShiftScheduleSchema(Schema):
    recurrence = fields.String(required=True)  # weekly | one_time
    days = fields.List(fields.Integer(), required=False)  # 0-6 for weekly
    start_time = fields.String(required=True)  # HH:MM
    end_time = fields.String(required=True)    # HH:MM
    timezone = fields.String(required=True)
    effective_from = fields.Date(required=False, allow_none=True)
    effective_to = fields.Date(required=False, allow_none=True)
    store_id = fields.String(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True)
    exceptions = fields.List(fields.Dict(), required=False)  # [{date: YYYY-MM-DD, start_time,end_time,notes}]

class ShiftLogSchema(Schema):
    staff_id = fields.String(required=True)
    clock_in = fields.DateTime(required=True)
    clock_out = fields.DateTime(required=False, allow_none=True)
    source = fields.String(required=False, allow_none=True)
    store_id = fields.String(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True)

# Supported permissions (can be expanded)
SUPPORTED_PERMISSIONS = [
    # Manager (L1)
    "discount.approve", "product.manage", "analytics.view.store", "shift.view",
    # Sales (L2)
    "billing.use_pos", "customer.view", "assist.ai", "tryon.use",
    # Inventory (L3)
    "inventory.modify", "tag.assign", "inventory.flow.view",
    # Admin-only staff management
    "staff.manage",
]

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

# ---- Staff CRUD ----
@bp.get("/staff")
@jwt_required()
@require_permissions("shift.view")
def list_staff():
    db = current_app.extensions['mongo_db']
    q = (request.args.get("query") or "").strip().lower()
    status = request.args.get("status")
    role_id = request.args.get("role_id")
    page = int(request.args.get("page") or 1)
    limit = min(int(request.args.get("limit") or 20), 100)

    filt = {}
    if q:
        filt["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone_number": {"$regex": q, "$options": "i"}},
        ]
    if status:
        filt["status"] = status
    if role_id and _oid(role_id):
        filt["role._id"] = _oid(role_id)

    # Newest first: prefer created_at desc, fallback by _id desc
    sort_spec = [("created_at", -1), ("_id", -1)]
    cursor = db.users.find(filt).sort(sort_spec).skip((page-1)*limit).limit(limit)
    items = []
    for u in cursor:
        items.append({
            "id": str(u["_id"]),
            "full_name": u.get("full_name") or u.get("name"),
            "email": u.get("email"),
            "phone_number": u.get("phone_number"),
            "status": u.get("status") or ("active" if u.get("is_active", True) else "inactive"),
            "role": {"_id": str(u["role"]["_id"]) , "role_name": u["role"]["role_name"]} if u.get("role") else None,
        })
    total = db.users.count_documents(filt)
    return jsonify({"items": items, "page": page, "limit": limit, "total": total})

@bp.post("/staff")
@jwt_required()
@require_permissions("staff.manage")
def create_staff():
    db = current_app.extensions['mongo_db']
    try:
        payload = StaffSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400

    email_l = payload["email"].lower()
    if db.users.find_one({"email": email_l}):
        return jsonify({"error": "email_in_use"}), 409

    role = db.roles.find_one({"_id": _oid(payload["role_id"])})
    if not role:
        return jsonify({"error": "role_not_found"}), 404

    user_doc = {
        "full_name": payload["full_name"],
        "email": email_l,
        "phone_number": payload.get("phone_number"),
        "role": {"_id": role["_id"], "role_name": role["role_name"]},
        "status": payload.get("status") or "active",
        "created_at": _now(db),
    }
    ins = db.users.insert_one(user_doc)
    return jsonify({"id": str(ins.inserted_id)}), 201

@bp.get("/staff/<id>")
@jwt_required()
@require_permissions("shift.view")
def get_staff(id):
    db = current_app.extensions['mongo_db']
    u = db.users.find_one({"_id": _oid(id)})
    if not u:
        return jsonify({"error": "not_found"}), 404
    return jsonify({
        "id": str(u["_id"]),
        "full_name": u.get("full_name") or u.get("name"),
        "email": u.get("email"),
        "phone_number": u.get("phone_number"),
        "status": u.get("status") or ("active" if u.get("is_active", True) else "inactive"),
        "role": {"_id": str(u["role"]["_id"]) , "role_name": u["role"]["role_name"]} if u.get("role") else None,
        "created_at": u.get("created_at"),
    })

@bp.put("/staff/<id>")
@jwt_required()
@require_permissions("staff.manage")
def update_staff(id):
    db = current_app.extensions['mongo_db']
    try:
        payload = StaffUpdateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    update = {}
    if "full_name" in payload:
        update["full_name"] = payload["full_name"]
    if "phone_number" in payload:
        update["phone_number"] = payload["phone_number"]
    if "status" in payload:
        update["status"] = payload["status"]
    if "role_id" in payload:
        role = db.roles.find_one({"_id": _oid(payload["role_id"])})
        if not role:
            return jsonify({"error": "role_not_found"}), 404
        update["role"] = {"_id": role["_id"], "role_name": role["role_name"]}
    res = db.users.update_one({"_id": _oid(id)}, {"$set": update})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"updated": True})

@bp.patch("/staff/<id>/status")
@jwt_required()
@require_permissions("staff.manage")
def patch_staff_status(id):
    db = current_app.extensions['mongo_db']
    body = request.get_json() or {}
    status = body.get("status")
    if status not in ["active", "inactive"]:
        return jsonify({"error": "validation_failed", "details": {"status": ["invalid"]}}), 400
    res = db.users.update_one({"_id": _oid(id)}, {"$set": {"status": status}})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"updated": True})

# ---- Roles & Permissions ----
@bp.get("/roles")
@jwt_required()
def list_roles():
    db = current_app.extensions['mongo_db']
    # Auto-seed defaults if empty
    if db.roles.count_documents({}) == 0:
        defaults = {
            "Admin": ["*"],
            "Staff_L1": [
                "discount.approve", "product.manage", "analytics.view.store", "shift.view"
            ],
            "Staff_L2": [
                "billing.use_pos", "customer.view", "assist.ai", "tryon.use"
            ],
            "Staff_L3": [
                "inventory.modify", "tag.assign", "inventory.flow.view"
            ],
            "Customer": ["profile.read", "orders.read"],
        }
        for rn, perms in defaults.items():
            db.roles.update_one({"role_name": rn}, {"$set": {"role_name": rn, "permissions": perms}}, upsert=True)
    roles = []
    for r in db.roles.find({}):
        roles.append({"id": str(r["_id"]), "role_name": r.get("role_name"), "permissions": r.get("permissions", [])})
    return jsonify({"items": roles})

@bp.post("/roles")
@jwt_required()
@require_permissions("staff.manage")
def create_role():
    db = current_app.extensions['mongo_db']
    try:
        payload = RoleSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    if db.roles.find_one({"role_name": payload["role_name"]}):
        return jsonify({"error": "role_exists"}), 409
    ins = db.roles.insert_one({"role_name": payload["role_name"], "permissions": payload["permissions"]})
    return jsonify({"id": str(ins.inserted_id)}), 201

@bp.put("/roles/<id>/permissions")
@jwt_required()
@require_permissions("staff.manage")
def update_role_permissions(id):
    db = current_app.extensions['mongo_db']
    try:
        payload = RolePermsSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    res = db.roles.update_one({"_id": _oid(id)}, {"$set": {"permissions": payload["permissions"]}})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"updated": True})

@bp.get("/permissions")
@jwt_required()
@require_permissions("*")
def list_permissions():
    return jsonify({"items": SUPPORTED_PERMISSIONS})

# ---- Shift Schedules ----
@bp.get("/staff/<id>/shift-schedules")
@jwt_required()
@require_permissions("shift.view")
def list_shift_schedules(id):
    db = current_app.extensions['mongo_db']
    schedules = []
    for s in db.shift_schedules.find({"staff_id": str(_oid(id))}):
        s["id"] = str(s.pop("_id"))
        schedules.append(s)
    return jsonify({"items": schedules})

@bp.post("/staff/<id>/shift-schedules")
@jwt_required()
@require_permissions("staff.manage")
def create_shift_schedule(id):
    db = current_app.extensions['mongo_db']
    try:
        payload = ShiftScheduleSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    # Validate one-time requires effective_from
    if payload.get("recurrence") == "one_time" and not payload.get("effective_from"):
        return jsonify({"error": "validation_failed", "details": {"effective_from": ["required for one_time"]}}), 400

    doc = dict(payload)
    doc["staff_id"] = str(_oid(id))

    # Detect duplicates (same key fields)
    match = {
        "staff_id": doc["staff_id"],
        "recurrence": doc["recurrence"],
        "start_time": doc.get("start_time"),
        "end_time": doc.get("end_time"),
        "timezone": doc.get("timezone"),
    }
    if doc["recurrence"] == "weekly":
        match["days"] = sorted(doc.get("days") or [])
    else:
        # For one-time compare on date window
        if doc.get("effective_from"):
            match["effective_from"] = doc.get("effective_from")
        if doc.get("effective_to"):
            match["effective_to"] = doc.get("effective_to")
    if doc.get("store_id"):
        match["store_id"] = doc.get("store_id")

    existing = db.shift_schedules.find_one(match)
    if existing:
        # Overwrite notes and any changes
        update_doc = {k: v for k, v in doc.items() if k not in ["staff_id"]}
        db.shift_schedules.update_one({"_id": existing["_id"]}, {"$set": update_doc})
        return jsonify({"id": str(existing["_id"]), "updated": True}), 200

    # Insert new
    doc["created_at"] = _now(db)
    ins = db.shift_schedules.insert_one(doc)
    return jsonify({"id": str(ins.inserted_id), "created": True}), 201

@bp.put("/shift-schedules/<sid>")
@jwt_required()
@require_permissions("staff.manage")
def update_shift_schedule(sid):
    db = current_app.extensions['mongo_db']
    try:
        payload = ShiftScheduleSchema(partial=True).load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    res = db.shift_schedules.update_one({"_id": _oid(sid)}, {"$set": payload})
    if res.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"updated": True})

@bp.delete("/shift-schedules/<sid>")
@jwt_required()
@require_permissions("staff.manage")
def delete_shift_schedule(sid):
    db = current_app.extensions['mongo_db']
    res = db.shift_schedules.delete_one({"_id": _oid(sid)})
    return jsonify({"deleted": res.deleted_count > 0})

@bp.get("/shift-schedules")
@jwt_required()
@require_permissions("shift.view")
def query_shift_schedules():
    db = current_app.extensions['mongo_db']
    from_dt = request.args.get("from")
    to_dt = request.args.get("to")
    store_id = request.args.get("store_id")
    filt = {}
    if store_id:
        filt["store_id"] = store_id
    # naive range filter on effective dates (optional)
    if from_dt:
        filt["effective_from"] = {"$gte": datetime.fromisoformat(from_dt)}
    if to_dt:
        filt.setdefault("effective_to", {})["$lte"] = datetime.fromisoformat(to_dt)
    items = []
    for s in db.shift_schedules.find(filt).limit(200):
        s["id"] = str(s.pop("_id"))
        items.append(s)
    return jsonify({"items": items})

# ---- Shift Logs ----
@bp.get("/shift-logs")
@jwt_required()
@require_permissions("shift.view")
def list_shift_logs():
    db = current_app.extensions['mongo_db']
    staff_id = request.args.get("staff_id")
    from_dt = request.args.get("from")
    to_dt = request.args.get("to")
    store_id = request.args.get("store_id")
    filt = {}
    if staff_id and _oid(staff_id):
        filt["staff_id"] = str(_oid(staff_id))
    if store_id:
        filt["store_id"] = store_id
    if from_dt:
        filt["clock_in"] = {"$gte": datetime.fromisoformat(from_dt)}
    if to_dt:
        filt.setdefault("clock_out", {})["$lte"] = datetime.fromisoformat(to_dt)
    logs = []
    for l in db.shift_logs.find(filt).sort("clock_in", -1).limit(500):
        l["id"] = str(l.pop("_id"))
        logs.append(l)
    return jsonify({"items": logs})

@bp.post("/shift-logs")
@jwt_required()
@require_permissions("shift.view")
def create_shift_log():
    db = current_app.extensions['mongo_db']
    try:
        payload = ShiftLogSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    doc = dict(payload)
    doc["staff_id"] = str(_oid(payload["staff_id"]))
    ins = db.shift_logs.insert_one(doc)
    return jsonify({"id": str(ins.inserted_id)}), 201
