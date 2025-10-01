import razorpay
import os
from datetime import datetime

def get_razorpay_client():
    """Get configured Razorpay client"""
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    if not key_id or not key_secret:
        raise ValueError("Razorpay credentials not found in environment variables")
    
    return razorpay.Client(auth=(key_id, key_secret))

def process_refund(payment_id, amount_paise, notes=None):
    """
    Process a refund for a Razorpay payment
    
    Args:
        payment_id (str): Razorpay payment ID
        amount_paise (int): Amount to refund in paise
        notes (str, optional): Refund notes
    
    Returns:
        dict: Refund response from Razorpay or error details
    """
    try:
        client = get_razorpay_client()
        
        # Build refund data - only include amount (speed parameter not supported in test mode)
        refund_data = {
            "amount": int(amount_paise)
        }
        
        # Add notes if provided
        if notes:
            refund_data["notes"] = {"reason": notes}
        
        # Process refund
        refund = client.payment.refund(payment_id, refund_data)
        
        return {
            "success": True,
            "refund": refund,
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except razorpay.errors.BadRequestError as e:
        error_msg = str(e)
        error_details = {}
        
        # Try to extract error details from the exception
        if hasattr(e, 'args') and len(e.args) > 0:
            error_msg = str(e.args[0])
        
        return {
            "success": False,
            "error": "bad_request",
            "message": error_msg,
            "details": error_details
        }
    except razorpay.errors.ServerError as e:
        return {
            "success": False,
            "error": "server_error", 
            "message": "Razorpay server error, please try again"
        }
    except Exception as e:
        return {
            "success": False,
            "error": "unknown_error",
            "message": str(e)
        }

def get_refund_status(refund_id):
    """
    Get refund status from Razorpay
    
    Args:
        refund_id (str): Razorpay refund ID
        
    Returns:
        dict: Refund details or error
    """
    try:
        client = get_razorpay_client()
        refund = client.refund.fetch(refund_id)
        
        return {
            "success": True,
            "refund": refund
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def inr_paise(amount_rupees):
    """Convert rupees to paise"""
    try:
        return max(0, int(round(float(amount_rupees) * 100)))
    except (ValueError, TypeError):
        return 0

def paise_to_inr(amount_paise):
    """Convert paise to rupees"""
    try:
        return round(float(amount_paise) / 100, 2)
    except (ValueError, TypeError):
        return 0.0
