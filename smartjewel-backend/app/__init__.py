"""Application package initializer.

Exposes create_app for WSGI servers and CLI usage.
"""

from .init import create_app  # re-export for `from app import create_app`

__all__ = ["create_app"]
