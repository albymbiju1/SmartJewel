from typing import Optional
from flask import current_app
# Email notifications disabled - order_status_email template not implemented
# from app.utils.mailer import send_email
# from app.utils.email_templates import order_status_email



def send_order_status_notification(order: dict, new_status: str, notification_types: list = None) -> bool:
    """
    Send notifications to customer when order status changes.

    Currently supports email notifications. SMS and Push can be added later
    by integrating with services like Twilio and Firebase.

    Args:
        order: Order document from database
        new_status: The new status (shipped, delivered, cancelled, refunded)
        notification_types: List of notification types to send (default: ['email'])

    Returns:
        bool: True if notifications sent successfully, False otherwise
    """
    print(f"\n{'='*60}")
    print(f"[Notification] send_order_status_notification CALLED")
    print(f"[Notification] Order ID: {order.get('_id')}")
    print(f"[Notification] New Status: {new_status}")
    print(f"[Notification] Order keys: {list(order.keys())}")
    print(f"{'='*60}")

    if notification_types is None:
        notification_types = ['database']  # Default to database notifications only

    # Notify for all these status changes (expanded list)
    notify_statuses = {
        "confirmed",      # Order confirmed
        "processing",     # Order being processed
        "paid",           # Payment received
        "shipped",        # Order shipped
        "out_for_delivery", # Out for delivery
        "delivered",      # Order delivered
        "cancelled",      # Order cancelled
        "refunded"        # Order refunded
    }
    if new_status.lower() not in notify_statuses:
        print(f"[Notification] Status '{new_status}' not in notify_statuses, skipping")
        return True  # Not an error, just no notification needed

    print(f"[Notification] Status '{new_status}' IS in notify_statuses, proceeding...")

    success = True
    db = current_app.extensions.get('mongo_db')
    print(f"[Notification] Database connection: {'OK' if db is not None else 'NONE'}")

    try:
        # Save notification to database
        if db is not None:
            from bson import ObjectId

            # Try multiple ways to get user_id
            user_id = None
            customer = order.get("customer", {}) or {}

            # Method 1: From customer.userId (string)
            if customer.get("userId"):
                user_id = customer.get("userId")
                print(f"[Notification] Got user_id from customer.userId: {user_id}")

            # Method 2: From top-level user_id (could be ObjectId or string)
            if not user_id and order.get("user_id"):
                user_id = order.get("user_id")
                print(f"[Notification] Got user_id from order.user_id: {user_id}")

            # Method 3: From customer.email lookup (case-insensitive)
            if not user_id and customer.get("email"):
                email = customer.get("email").lower().strip()
                print(f"[Notification] Looking up user by email: {email}")
                user_doc = db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
                if user_doc:
                    user_id = user_doc.get("_id")
                    print(f"[Notification] Found user by email: {user_id}")

            # Method 4: Lookup by customer phone
            if not user_id and customer.get("phone"):
                phone = customer.get("phone")
                print(f"[Notification] Looking up user by phone: {phone}")
                user_doc = db.users.find_one({"phone_number": phone})
                if user_doc:
                    user_id = user_doc.get("_id")
                    print(f"[Notification] Found user by phone: {user_id}")

            if not user_id:
                print(f"[Notification] ERROR: Could not determine user_id for order {order.get('_id')}")
                print(f"[Notification] Order customer: {customer}")
                print(f"[Notification] Order user_id field: {order.get('user_id')}")
                print(f"[Notification] Full order keys: {list(order.keys())}")
                return False

            # Update the order with customer.userId if it was found but not set
            if user_id and order.get('_id') and not customer.get("userId"):
                try:
                    user_id_str = str(user_id) if isinstance(user_id, ObjectId) else user_id
                    db.orders.update_one(
                        {"_id": order.get('_id')},
                        {"$set": {"customer.userId": user_id_str}}
                    )
                    print(f"[Notification] Updated order {order.get('_id')} with customer.userId: {user_id_str}")
                except Exception as update_err:
                    print(f"[Notification] Failed to update customer.userId: {update_err}")

            if user_id:
                try:
                    from bson import ObjectId
                    from datetime import datetime
                    
                    # Ensure user_id is ObjectId
                    if isinstance(user_id, str):
                        user_id = ObjectId(user_id)
                        
                    # Extract product names from order items
                    items = order.get('items', [])
                    product_names = []
                    for item in items[:3]:  # Show up to 3 products
                        name = item.get('name') or item.get('title') or item.get('sku', 'Item')
                        product_names.append(name)
                    
                    # Create product description
                    if len(product_names) == 0:
                        product_desc = "your order"
                    elif len(product_names) == 1:
                        product_desc = product_names[0]
                    elif len(product_names) == 2:
                        product_desc = f"{product_names[0]} and {product_names[1]}"
                    else:
                        product_desc = f"{product_names[0]}, {product_names[1]}"
                        if len(items) > 3:
                            product_desc += f" and {len(items) - 2} more items"
                        elif len(items) == 3:
                            product_desc += f" and {product_names[2]}"
                    
                    # Create status-specific title and message
                    status_lower = new_status.lower()
                    status_messages = {
                        "confirmed": {
                            "title": "Order Confirmed",
                            "message": f"Your order containing {product_desc} has been confirmed and is being prepared."
                        },
                        "processing": {
                            "title": "Order Processing",
                            "message": f"Your order containing {product_desc} is now being processed."
                        },
                        "paid": {
                            "title": "Payment Received",
                            "message": f"Payment for your order containing {product_desc} has been received successfully."
                        },
                        "shipped": {
                            "title": "Order Shipped",
                            "message": f"Great news! Your order containing {product_desc} has been shipped."
                        },
                        "out_for_delivery": {
                            "title": "Out for Delivery",
                            "message": f"Your order containing {product_desc} is out for delivery and will arrive soon."
                        },
                        "delivered": {
                            "title": "Order Delivered",
                            "message": f"Your order containing {product_desc} has been delivered. Enjoy!"
                        },
                        "cancelled": {
                            "title": "Order Cancelled",
                            "message": f"Your order containing {product_desc} has been cancelled."
                        },
                        "refunded": {
                            "title": "Refund Processed",
                            "message": f"A refund for your order containing {product_desc} has been processed."
                        }
                    }

                    # Get status-specific message or use default
                    status_info = status_messages.get(status_lower, {
                        "title": f"Order {new_status.title()}",
                        "message": f"Your order containing {product_desc} has been updated to {new_status}."
                    })

                    notification = {
                        "user_id": user_id,
                        "title": status_info["title"],
                        "message": status_info["message"],
                        "type": "order_status",
                        "status": new_status,
                        "data": {
                            "order_id": str(order.get('_id')),
                            "status": new_status
                        },
                        "is_read": False,
                        "created_at": datetime.utcnow(),
                        "related_entity_id": str(order.get('_id')),
                        "related_entity_type": "order"
                    }
                    result = db.notifications.insert_one(notification)
                    print(f"[Notification] SUCCESS: Created notification {result.inserted_id}")
                    print(f"   User: {user_id}, Status: {new_status}, Order: {order.get('_id')}")
                    print(f"   Message: {notification['message']}")
                except Exception as e:
                    print(f"[Notification] ERROR: Failed to save notification to DB: {e}")
                    import traceback
                    traceback.print_exc()

        # Email notifications disabled - order_status_email template not implemented
        # TODO: Implement email notifications when order_status_email template is created
        # TODO: Add SMS notification support
        # TODO: Add Push notification support

        return success

    except Exception as e:
        print(f"Failed to send order status notifications for order {order.get('_id')}: {e}")
        return False


def should_send_notification(old_status: str, new_status: str) -> bool:
    """
    Determine if a notification should be sent based on status transition.

    Args:
        old_status: Previous order status
        new_status: New order status

    Returns:
        bool: True if notification should be sent
    """
    # Notify for all these status changes (expanded list)
    notify_statuses = {
        "confirmed",      # Order confirmed
        "processing",     # Order being processed
        "paid",           # Payment received
        "shipped",        # Order shipped
        "out_for_delivery", # Out for delivery
        "delivered",      # Order delivered
        "cancelled",      # Order cancelled
        "refunded"        # Order refunded
    }

    # Don't send if status hasn't actually changed
    if old_status == new_status:
        return False

    # Send notification if new status is one we notify about
    return new_status.lower() in notify_statuses