from typing import Tuple, Optional

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


def reset_password_email(name: str, code: str, ttl_minutes: int) -> Tuple[str, str, str]:
    """Return (subject, text_body, html_body) for password reset code."""
    subject = "SmartJewel Password Reset Code"
    text = (
        f"Hello {name},\n\n"
        f"Your password reset code is: {code}\n"
        f"This code will expire in {ttl_minutes} minutes.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— SmartJewel"
    )
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p>Hello {name},</p>
      <p>Your password reset code is:</p>
      <div style="font-size:24px;font-weight:700;letter-spacing:3px;margin:12px 0;">{code}</div>
      <p>This code will expire in <b>{ttl_minutes} minutes</b>.</p>
      <p style="color:#666">If you did not request this, you can ignore this email.</p>
      <p>— SmartJewel</p>
    </div>
    """
    return subject, text, html


def price_drop_email(
    name: str,
    product_name: str,
    product_image: Optional[str],
    old_price: Optional[float],
    new_price: float,
    savings: float,
    percentage: float,
    product_url: str,
    unsubscribe_url: str
) -> Tuple[str, str, str]:
    """Return (subject, text_body, html_body) for price drop alert."""
    subject = f"🎉 Price Drop Alert: {product_name} is now ₹{new_price:,.0f}!"
    
    text = (
        f"Hello {name},\n\n"
        f"Great News! The price dropped on an item you're watching:\n\n"
        f"{product_name}\n"
        f"Was: ₹{old_price:,.0f}\n" if old_price else ""
        f"Now: ₹{new_price:,.0f}\n"
        f"You save: ₹{savings:,.0f} ({percentage:.1f}% off)\n\n" if savings > 0 else ""
        f"Shop now: {product_url}\n\n"
        f"This is a limited-time offer. Don't miss out!\n\n"
        f"Unsubscribe from price alerts: {unsubscribe_url}\n\n"
        "— SmartJewel"
    )
    
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #d97706, #f59e0b);padding:20px;text-align:center;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">🎉 Price Drop Alert!</h2>
      </div>
      
      <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;margin-bottom:20px">Hello {name},</p>
        
        <p style="font-size:16px;color:#059669;font-weight:600;margin-bottom:20px">Great News! The price dropped on an item you're watching:</p>
        
        <div style="border:1px solid #e5e7eb;padding:20px;border-radius:8px;background:#f9fafb;margin-bottom:20px">
          {f'<img src="{product_image}" alt="{product_name}" style="width:200px;height:200px;object-fit:cover;border-radius:4px;margin-bottom:15px" />' if product_image else ''}
          <h3 style="margin:10px 0;color:#111827">{product_name}</h3>
          
          <div style="margin:15px 0">
            {f'<p style="text-decoration:line-through;color:#6b7280;margin:0">₹{old_price:,.0f}</p>' if old_price else ''}
            <p style="font-size:28px;color:#16a34a;font-weight:700;margin:5px 0">₹{new_price:,.0f}</p>
            {f'<p style="color:#059669;font-size:16px;margin:0">You save ₹{savings:,.0f} ({percentage:.1f}% off)</p>' if savings > 0 else ''}
          </div>
          
          <a href="{product_url}" style="display:inline-block;background:#d97706;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:15px">
            Buy Now
          </a>
        </div>
        
        <p style="color:#6b7280;font-size:14px;margin-top:20px">
          ⏰ This is a limited-time offer. Don't miss out!
        </p>
        
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0" />
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
          You're receiving this because you subscribed to price alerts for this product.<br/>
          <a href="{unsubscribe_url}" style="color:#6b7280;text-decoration:underline">Unsubscribe from price alerts</a>
        </p>
      </div>
    </div>
    """
    
    return subject, text, html


def stock_available_email(
    name: str,
    product_name: str,
    product_image: Optional[str],
    price: Optional[float],
    product_url: str
) -> Tuple[str, str, str]:
    """Return (subject, text_body, html_body) for back-in-stock alert."""
    subject = f"📥 Back in Stock: {product_name}"
    
    text = (
        f"Hello {name},\n\n"
        f"Good news! An item you were waiting for is back in stock:\n\n"
        f"{product_name}\n"
        f"Price: ₹{price:,.0f}\n" if price else ""
        f"Shop now: {product_url}\n\n"
        f"Order now before it's gone again!\n\n"
        "— SmartJewel"
    )
    
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#222;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #2563eb, #3b82f6);padding:20px;text-align:center;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">📥 Back in Stock!</h2>
      </div>
      
      <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;margin-bottom:20px">Hello {name},</p>
        
        <p style="font-size:16px;color:#2563eb;font-weight:600;margin-bottom:20px">Good news! An item you were waiting for is back in stock:</p>
        
        <div style="border:1px solid #e5e7eb;padding:20px;border-radius:8px;background:#f9fafb;margin-bottom:20px;text-align:center">
          {f'<img src="{product_image}" alt="{product_name}" style="width:200px;height:200px;object-fit:cover;border-radius:4px;margin-bottom:15px" />' if product_image else ''}
          <h3 style="margin:10px 0;color:#111827">{product_name}</h3>
          
          {f'<p style="font-size:24px;color:#111827;font-weight:700;margin:15px 0">₹{price:,.0f}</p>' if price else ''}
          
          <a href="{product_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;margin-top:15px">
            Order Now
          </a>
        </div>
        
        <p style="color:#6b7280;font-size:14px;margin-top:20px;text-align:center">
          ⚡ Don't wait - order now before it's gone again!
        </p>
        
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0" />
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
          You're receiving this because you requested to be notified when this product is back in stock.
        </p>
      </div>
    </div>
    """
    
    return subject, text, html