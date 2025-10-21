from typing import Optional
from flask import current_app
from app.utils.mailer import send_email
from app.utils.email_templates import order_status_email


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
    if notification_types is None:
        notification_types = ['email']

    # Only send notifications for specific status changes
    notify_statuses = {"shipped", "delivered", "cancelled", "refunded"}
    if new_status.lower() not in notify_statuses:
        return True  # Not an error, just no notification needed

    success = True

    try:
        # Extract customer information
        customer = order.get("customer", {})
        customer_email = customer.get("email")
        customer_name = customer.get("name", "Valued Customer")

        # Extract order information
        order_id = str(order.get("_id"))
        items = order.get("items", [])

        # Get tracking ID for shipped orders
        tracking_id = None
        if new_status.lower() == "shipped":
            shipping = order.get("shipping", {})
            if isinstance(shipping, dict):
                tracking_id = shipping.get("trackingId") or shipping.get("tracking_id")

        # Send email notification
        if 'email' in notification_types:
            if not customer_email:
                print(f"No customer email found for order {order.get('_id')}")
                success = False
            else:
                try:
                    # Get email content
                    subject, text_body, html_body = order_status_email(
                        customer_name=customer_name,
                        order_id=order_id,
                        status=new_status,
                        items=items,
                        tracking_id=tracking_id
                    )

                    # Send email
                    send_email(
                        to_email=customer_email,
                        subject=subject,
                        text_body=text_body,
                        html_body=html_body
                    )

                    print(f"Order status email sent for order {order_id}: {new_status}")

                except Exception as e:
                    print(f"Failed to send order status email for order {order.get('_id')}: {e}")
                    success = False

        # TODO: Add SMS notification support
        # if 'sms' in notification_types:
        #     send_sms_notification(customer_phone, new_status, order_id)

        # TODO: Add Push notification support
        # if 'push' in notification_types:
        #     send_push_notification(customer_fcm_token, new_status, order_id)

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
    # Only notify for these specific status changes
    notify_statuses = {"shipped", "delivered", "cancelled", "refunded"}

    # Don't send if status hasn't actually changed
    if old_status == new_status:
        return False

    # Send notification if new status is one we notify about
    return new_status.lower() in notify_statuses