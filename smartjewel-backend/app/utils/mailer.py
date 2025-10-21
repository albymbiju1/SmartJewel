import smtplib
from email.message import EmailMessage
from typing import Optional
from flask import current_app


def send_email(to_email: str, subject: str, text_body: str, html_body: Optional[str] = None) -> None:
    """Send an email using SMTP settings from app config.

    Raises exceptions if sending fails, so caller can handle/log.
    """
    cfg = current_app.config
    host = cfg.get("SMTP_HOST")
    port = int(cfg.get("SMTP_PORT", 587))
    username = cfg.get("SMTP_USERNAME")
    password = cfg.get("SMTP_PASSWORD")
    use_tls = bool(cfg.get("SMTP_USE_TLS", True))
    from_addr = cfg.get("SMTP_FROM") or username

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    if use_tls:
        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(msg)