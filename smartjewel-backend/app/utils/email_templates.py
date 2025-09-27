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