"""Authorization helpers: role / permission decorators."""
from functools import wraps
from typing import Iterable, Callable
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def _has_any(claim_values: Iterable[str], required: Iterable[str]) -> bool:
    s = set(claim_values or [])
    for r in required:
        if r in s:
            return True
    return False


def require_roles(*roles: str) -> Callable:
    """Require that ALL listed roles are present."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if not all(r in claims.get("roles", []) for r in roles):
                return jsonify({"error": "forbidden", "reason": "missing_roles", "required": roles}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_any_role(*roles: str) -> Callable:
    """Require that at least one of the roles is present."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if not _has_any(claims.get("roles", []), roles):
                return jsonify({"error": "forbidden", "reason": "missing_any_role", "options": roles}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_permissions(*perms: str) -> Callable:
    """Require all listed permissions (wildcard * matches all)."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_perms = claims.get("perms", [])
            if "*" in user_perms:
                return fn(*args, **kwargs)
            if not all(p in user_perms for p in perms):
                return jsonify({"error": "forbidden", "reason": "missing_permissions", "required": perms}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


STAFF_LEVELS = ["staff_l1", "staff_l2", "staff_l3"]

def is_staff(roles: Iterable[str]) -> bool:
    return any(r in STAFF_LEVELS for r in roles or [])
