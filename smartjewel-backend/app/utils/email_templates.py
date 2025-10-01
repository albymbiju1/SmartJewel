from typing import Tuple

def otp_email(name: str, otp: str, ttl_minutes: int) -> Tuple[str, str, str]:
    """Return (subject, text_body, html_body) for OTP verification."""
    subject = "Your SmartJewel verification code"
    text = (
        f"Hello {name},\n\n"
        f"Your verification code is: {otp}\n"
        f"This code will expire in {ttl_minutes} minutes.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— SmartJewel"
    )
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p>Hello {name},</p>
      <p>Your verification code is:</p>
      <div style="font-size:24px;font-weight:700;letter-spacing:3px;margin:12px 0;">{otp}</div>
      <p>This code will expire in <b>{ttl_minutes} minutes</b>.</p>
      <p style="color:#666">If you did not request this, you can ignore this email.</p>
      <p>— SmartJewel</p>
    </div>
    """
    return subject, text, html


def order_status_email(customer_name: str, order_id: str, status: str, items: list = None, tracking_id: str = None) -> Tuple[str, str, str]:
    """Return (subject, text_body, html_body) for order status updates."""

    status_messages = {
        "shipped": {
            "subject": f"Your SmartJewel Order #{order_id} Has Been Shipped",
            "title": "Your Order Has Been Shipped!",
            "message": "Great news! Your order has been shipped and is on its way to you.",
        },
        "delivered": {
            "subject": f"Your SmartJewel Order #{order_id} Has Been Delivered",
            "title": "Your Order Has Been Delivered!",
            "message": "Your order has been successfully delivered. We hope you love your new jewelry!",
        },
        "cancelled": {
            "subject": f"Your SmartJewel Order #{order_id} Has Been Cancelled",
            "title": "Order Cancellation Confirmed",
            "message": "Your order has been cancelled as requested. If you have any questions, please contact our support team.",
        },
        "refunded": {
            "subject": f"Your SmartJewel Order #{order_id} Refund Has Been Processed",
            "title": "Refund Processed Successfully",
            "message": "Your refund has been processed and should appear in your account within 3-5 business days.",
        },
    }

    status_info = status_messages.get(status.lower(), {
        "subject": f"SmartJewel Order #{order_id} Status Update",
        "title": "Order Status Update",
        "message": f"Your order status has been updated to: {status.title()}",
    })

    subject = status_info["subject"]
    title = status_info["title"]
    message = status_info["message"]

    # Build item list if provided
    items_text = ""
    items_html = ""
    if items:
        items_text = "\n\nOrder Items:\n"
        items_html = "<h3>Order Items:</h3><ul>"
        for item in items:
            item_name = item.get("name", item.get("title", "Unknown Item"))
            quantity = item.get("quantity", 1)
            items_text += f"- {item_name} (Qty: {quantity})\n"
            items_html += f"<li>{item_name} (Qty: {quantity})</li>"
        items_html += "</ul>"

    # Add tracking info for shipped orders
    tracking_text = ""
    tracking_html = ""
    if tracking_id and status.lower() == "shipped":
        tracking_text = f"\n\nTracking Information:\nTracking ID: {tracking_id}\n"
        tracking_html = f"<h3>Tracking Information:</h3><p><strong>Tracking ID:</strong> {tracking_id}</p>"

    text = f"""Dear {customer_name},

{message}

Order ID: {order_id}{items_text}{tracking_text}

If you have any questions about your order, please don't hesitate to contact our customer support team.

Thank you for shopping with SmartJewel!

Best regards,
SmartJewel Team
support@smartjewel.com"""

    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222;max-width:600px;margin:0 auto;">
      <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#333">{title}</h2>
        <p>Dear {customer_name},</p>
        <p>{message}</p>
        <p><strong>Order ID:</strong> {order_id}</p>
        {items_html}
        {tracking_html}
      </div>

      <div style="background:#fff;padding:20px;border:1px solid #dee2e6;border-radius:8px;">
        <p>If you have any questions about your order, please don't hesitate to contact our customer support team.</p>
        <p>Thank you for shopping with <strong>SmartJewel</strong>!</p>
        <p>Best regards,<br>SmartJewel Team<br><a href="mailto:support@smartjewel.com">support@smartjewel.com</a></p>
      </div>
    </div>
    """

    return subject, text, html