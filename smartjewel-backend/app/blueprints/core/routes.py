from flask import Blueprint, jsonify
from flask import current_app
from app.utils.authz import require_any_role, require_roles, require_permissions
from datetime import datetime, timedelta

# Add a URL prefix for the core blueprint
bp = Blueprint("core", __name__, url_prefix="/core")

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

@bp.get("/admin/dashboard/stats")
@require_roles("Admin")
def admin_dashboard_stats():
    """Get real-time statistics for the admin dashboard"""
    db = current_app.extensions['mongo_db']
    
    print("=== Dashboard Stats Endpoint Called ===")
    
    # Get total sales (sum of all order amounts)
    total_sales = 0
    try:
        pipeline = [
            {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount", 0]}}}}
        ]
        result = list(db.orders.aggregate(pipeline))
        total_sales = float(result[0]["total"]) if result else 0
        print(f"Total sales calculation: {total_sales}")
    except Exception as e:
        print(f"Error calculating total sales: {e}")
        import traceback
        traceback.print_exc()
        total_sales = 0
    
    # Get total inventory items (active status)
    try:
        total_inventory_items = db.items.count_documents({"status": "active"})
        print(f"Total inventory items: {total_inventory_items}")
    except Exception as e:
        print(f"Error counting inventory items: {e}")
        import traceback
        traceback.print_exc()
        total_inventory_items = 0
    
    # Get total customers
    try:
        total_customers = db.users.count_documents({"role.role_name": "Customer", "status": "active"})
        print(f"Total customers: {total_customers}")
    except Exception as e:
        print(f"Error counting customers: {e}")
        import traceback
        traceback.print_exc()
        total_customers = 0
    
    # Get total staff members
    try:
        total_staff = db.users.count_documents({
            "role.role_name": {"$in": ["Staff_L1", "Staff_L2", "Staff_L3"]},
            "status": "active"
        })
        print(f"Total staff: {total_staff}")
    except Exception as e:
        print(f"Error counting staff: {e}")
        import traceback
        traceback.print_exc()
        total_staff = 0
    
    stats = {
        "total_sales": round(float(total_sales), 2),
        "total_inventory_items": int(total_inventory_items),
        "total_customers": int(total_customers),
        "total_staff": int(total_staff)
    }
    
    print(f"Dashboard stats response: {stats}")
    return jsonify(stats)

@bp.get("/admin/dashboard/recent-activity")
@require_roles("Admin")
def admin_dashboard_recent_activity():
    """Get recent activity for the admin dashboard"""
    db = current_app.extensions['mongo_db']
    
    print("=== Dashboard Recent Activity Endpoint Called ===")
    
    activities = []
    
    try:
        # Get recent orders (last 5)
        recent_orders = list(db.orders.find().sort("createdAt", -1).limit(5))
        for order in recent_orders:
            customer_name = order.get("customer", {}).get("name", "Unknown Customer")
            order_amount = order.get("amount", 0)
            order_status = order.get("status", "unknown")
            created_at = order.get("createdAt") or order.get("created_at")
            
            activities.append({
                "type": "order",
                "title": f"New order placed by {customer_name}",
                "description": f"Order amount: ₹{order_amount:,}, Status: {order_status}",
                "timestamp": created_at.isoformat() if created_at else None,
                "icon": "shopping-cart"
            })
        
        # Get recent inventory updates (last 5)
        recent_items = list(db.items.find().sort("updated_at", -1).limit(5))
        for item in recent_items:
            item_name = item.get("name", "Unknown Item")
            item_sku = item.get("sku", "N/A")
            updated_at = item.get("updated_at")
            
            activities.append({
                "type": "inventory",
                "title": f"Inventory item updated",
                "description": f"{item_name} (SKU: {item_sku})",
                "timestamp": updated_at.isoformat() if updated_at else None,
                "icon": "package"
            })
        
        # Get recent customer registrations (last 5)
        recent_customers = list(db.users.find({"role.role_name": "Customer"}).sort("created_at", -1).limit(5))
        for customer in recent_customers:
            customer_name = customer.get("full_name", "Unknown Customer")
            customer_email = customer.get("email", "N/A")
            created_at = customer.get("created_at")
            
            activities.append({
                "type": "customer",
                "title": f"New customer registered",
                "description": f"{customer_name} ({customer_email})",
                "timestamp": created_at.isoformat() if created_at else None,
                "icon": "user"
            })
        
        # Sort all activities by timestamp and take the most recent 6
        activities.sort(key=lambda x: x["timestamp"] if x["timestamp"] else "", reverse=True)
        activities = activities[:6]
        
        print(f"Dashboard recent activity response: {activities}")
        return jsonify(activities)
        
    except Exception as e:
        print(f"Error fetching recent activity: {e}")
        import traceback
        traceback.print_exc()
        return jsonify([]), 200
