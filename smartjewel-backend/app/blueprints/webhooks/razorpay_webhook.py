"""
Razorpay Webhook Handler
Listens for Razorpay events (refunds, payments, etc.) and updates order status
"""
from flask import Blueprint, request, jsonify, current_app
import hmac
import hashlib
import os
from datetime import datetime
from bson import ObjectId
from app.services.whatsapp_service import get_whatsapp_service

bp = Blueprint('razorpay_webhook', __name__, url_prefix='/webhooks')

def verify_webhook_signature(body, signature, secret):
    """Verify Razorpay webhook signature"""
    try:
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

@bp.route("/razorpay", methods=["POST"])
def handle_razorpay_webhook():
    """
    Handle Razorpay webhook events
    Supports: refund.created, refund.processed, refund.failed, payment.captured, etc.
    """
    db = current_app.extensions.get('mongo_db')
    if db is None:
        return jsonify({"error": "db_unavailable"}), 503
    
    # Get webhook secret from environment
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not webhook_secret:
        print("WARNING: RAZORPAY_WEBHOOK_SECRET not configured")
        # In development, you might want to skip verification
        # return jsonify({"error": "webhook_secret_not_configured"}), 500
    
    # Get signature from headers
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.get_data()
    
    # Verify signature (skip if secret not configured for development)
    if webhook_secret and not verify_webhook_signature(body, signature, webhook_secret):
        print(f"Invalid webhook signature received")
        return jsonify({"error": "invalid_signature"}), 401
    
    # Parse event data
    try:
        event = request.get_json()
    except Exception as e:
        print(f"Failed to parse webhook JSON: {e}")
        return jsonify({"error": "invalid_json"}), 400
    
    event_type = event.get("event")
    print(f"Received Razorpay webhook: {event_type}")
    
    # Handle different event types
    if event_type and event_type.startswith("refund."):
        return handle_refund_event(db, event, event_type)
    elif event_type and event_type.startswith("payment."):
        return handle_payment_event(db, event, event_type)
    else:
        print(f"Unhandled webhook event type: {event_type}")
        return jsonify({"status": "ignored", "event": event_type}), 200

def handle_refund_event(db, event, event_type):
    """Handle refund-related webhook events"""
    try:
        # Extract refund data from webhook payload
        payload = event.get("payload", {})
        refund_entity = payload.get("refund", {}).get("entity", {})
        payment_entity = payload.get("payment", {}).get("entity", {})
        
        refund_id = refund_entity.get("id")
        payment_id = refund_entity.get("payment_id") or payment_entity.get("id")
        refund_status = refund_entity.get("status")
        refund_amount = refund_entity.get("amount")
        
        if not payment_id:
            print(f"No payment_id in refund webhook")
            return jsonify({"error": "missing_payment_id"}), 400
        
        print(f"Processing refund event: {event_type} for payment {payment_id}")
        
        # Find order by payment_id
        order = db.orders.find_one({
            "$or": [
                {"payment_id": payment_id},
                {"razorpay_payment_id": payment_id}
            ]
        })
        
        if not order:
            print(f"Order not found for payment_id: {payment_id}")
            return jsonify({"error": "order_not_found"}), 404
        
        now = datetime.utcnow()
        
        # Update refund details based on event type
        update_data = {
            "$set": {
                "cancellation.refundDetails.status": refund_status,
                "cancellation.refundDetails.refundId": refund_id,
                "cancellation.refundDetails.amount": refund_amount,
                "cancellation.refundDetails.lastWebhookEvent": event_type,
                "cancellation.refundDetails.lastWebhookAt": now.isoformat(),
                "cancellation.refundDetails.razorpayResponse": refund_entity,
                "updatedAt": now
            }
        }
        
        # Add status history entry
        status_entry = {
            "status": f"refund {refund_status}",
            "timestamp": now,
            "by": "system:razorpay_webhook",
            "notes": f"Webhook event: {event_type}"
        }
        
        # Handle specific event types
        if event_type == "refund.processed":
            update_data["$set"]["cancellation.refundProcessed"] = True
            status_entry["notes"] = f"Refund processed successfully. Refund ID: {refund_id}"
            status_entry["status"] = "refunded"  # Set status for notification
        elif event_type == "refund.failed":
            update_data["$set"]["cancellation.refundProcessed"] = False
            update_data["$set"]["cancellation.refundDetails.failed"] = True
            status_entry["notes"] = f"Refund failed. Refund ID: {refund_id}"
        elif event_type == "refund.created":
            status_entry["notes"] = f"Refund initiated. Refund ID: {refund_id}"

        update_data["$push"] = {"statusHistory": status_entry}

        # Update order in database
        result = db.orders.update_one(
            {"_id": order["_id"]},
            update_data
        )

        if result.modified_count > 0:
            print(f"Order {order.get('orderId')} updated with refund status: {refund_status}")

            # Send notification for refund processed
            if event_type == "refund.processed":
                from app.services.notification_service import send_order_status_notification
                updated_order = db.orders.find_one({"_id": order["_id"]})
                send_order_status_notification(updated_order, "refunded")

            return jsonify({
                "status": "success",
                "order_id": order.get("orderId"),
                "refund_status": refund_status
            }), 200
        else:
            print(f"Order {order.get('orderId')} not modified (possibly same data)")
            return jsonify({"status": "no_change"}), 200
            
    except Exception as e:
        print(f"Error processing refund webhook: {e}")
        return jsonify({"error": "processing_error", "message": str(e)}), 500

def handle_payment_event(db, event, event_type):
    """Handle payment-related webhook events"""
    try:
        # Extract payment data
        payload = event.get("payload", {})
        payment_entity = payload.get("payment", {}).get("entity", {})
        
        payment_id = payment_entity.get("id")
        payment_status = payment_entity.get("status")
        
        if not payment_id:
            print(f"No payment_id in payment webhook")
            return jsonify({"error": "missing_payment_id"}), 400
        
        print(f"Processing payment event: {event_type} for payment {payment_id}")
        
        # Find order by payment_id
        order = db.orders.find_one({
            "$or": [
                {"payment_id": payment_id},
                {"razorpay_payment_id": payment_id}
            ]
        })
        
        if not order:
            print(f"Order not found for payment_id: {payment_id}")
            return jsonify({"error": "order_not_found"}), 404
        
        now = datetime.utcnow()
        
        # Update payment status based on event
        update_data = {
            "$set": {
                "payment_status": payment_status,
                "updatedAt": now
            }
        }
        
        # Add status history
        status_entry = {
            "status": payment_status,
            "timestamp": now,
            "by": "system:razorpay_webhook",
            "notes": f"Webhook event: {event_type}"
        }
        
        if event_type == "payment.captured" and order.get("status") != "paid":
            update_data["$set"]["status"] = "paid"
            status_entry["status"] = "paid"
            status_entry["notes"] = "Payment captured via webhook"
        
        update_data["$push"] = {"statusHistory": status_entry}
        
        # Update order
        result = db.orders.update_one(
            {"_id": order["_id"]},
            update_data
        )

        if result.modified_count > 0:
            print(f"Order {order.get('orderId')} updated with payment status: {payment_status}")

            # Send in-app notification for payment captured
            if event_type == "payment.captured":
                from app.services.notification_service import send_order_status_notification
                updated_order = db.orders.find_one({"_id": order["_id"]})
                send_order_status_notification(updated_order, "paid")

            # Send WhatsApp notification for captured payments
            if event_type == "payment.captured" and payment_status == "captured":
                try:
                    whatsapp = get_whatsapp_service()

                    # Extract customer details
                    customer = order.get('customer', {})
                    name = customer.get('name', 'Customer')
                    phone = customer.get('phone', '')

                    # Extract order items
                    items = order.get('items', [])
                    formatted_items = []
                    for item in items:
                        formatted_items.append({
                            'name': item.get('name', 'Item'),
                            'price': float(item.get('price', 0)),
                            'quantity': int(item.get('quantity', 1))
                        })

                    # Get order total
                    total = float(order.get('totalAmount', order.get('amount', 0)))
                    order_id = order.get('orderId', str(order.get('_id', '')))

                    if phone and formatted_items:
                        wa_result = whatsapp.send_order_confirmation(
                            name=name,
                            phone=phone,
                            order_id=order_id,
                            items=formatted_items,
                            total=total
                        )

                        if wa_result.get('success'):
                            print(f"✅ WhatsApp order confirmation sent for {order_id} to {phone}")
                        else:
                            print(f"⚠️ WhatsApp failed for {order_id}: {wa_result.get('message')}")
                    else:
                        print(f"⚠️ Cannot send WhatsApp for {order_id}: phone={phone}, items={len(formatted_items)}")

                except Exception as wa_error:
                    # Log error but don't fail order processing
                    print(f"❌ WhatsApp error for {order.get('orderId')}: {str(wa_error)}")

            return jsonify({
                "status": "success",
                "order_id": order.get("orderId"),
                "payment_status": payment_status
            }), 200
        else:
            return jsonify({"status": "no_change"}), 200
            
    except Exception as e:
        print(f"Error processing payment webhook: {e}")
        return jsonify({"error": "processing_error", "message": str(e)}), 500
