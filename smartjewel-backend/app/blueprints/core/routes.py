from flask import Blueprint, jsonify
from flask import current_app
from app.utils.authz import require_any_role, require_roles, require_permissions

bp = Blueprint("core", __name__)

@bp.get("/healthz")
def health():
    return jsonify({"status": "ok"}), 200

@bp.get("/admin/panel")
@require_roles("admin")
def admin_panel():
    db = current_app.extensions['mongo_db']
    return jsonify({"message": "admin_area"}), 200

@bp.get("/staff/overview")
@require_any_role("staff_l1", "staff_l2", "staff_l3", "admin")
def staff_overview():
    db = current_app.extensions['mongo_db']
    return jsonify({"message": "staff_area"}), 200

@bp.get("/inventory/export")
@require_permissions("inventory.export")
def inventory_export():
    db = current_app.extensions['mongo_db']
    return jsonify({"message": "export_ready"}), 200