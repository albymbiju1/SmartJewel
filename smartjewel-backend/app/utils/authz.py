"""Authorization helpers: role / permission decorators."""
from functools import wraps
from typing import Iterable, Callable
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
import logging

log = logging.getLogger(__name__)


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
            log.debug(f"require_roles: Required roles: {roles}, User roles: {claims.get('roles', [])}")
            if not all(r in claims.get("roles", []) for r in roles):
                log.warning(f"require_roles: Access denied. Required: {roles}, Has: {claims.get('roles', [])}")
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
            log.debug(f"require_any_role: Required roles: {roles}, User roles: {claims.get('roles', [])}")
            if not _has_any(claims.get("roles", []), roles):
                log.warning(f"require_any_role: Access denied. Required: {roles}, Has: {claims.get('roles', [])}")
                return jsonify({"error": "forbidden", "reason": "missing_any_role", "options": roles}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_permissions(*perms: str) -> Callable:
    """Require all listed permissions (wildcard * matches all)."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                # Check if Authorization header exists
                auth_header = request.headers.get('Authorization', 'NOT_PROVIDED')
                log.debug(f"require_permissions: Authorization header: {auth_header[:20]}..." if auth_header != 'NOT_PROVIDED' else f"require_permissions: Authorization header: NOT_PROVIDED")
                
                verify_jwt_in_request()
                claims = get_jwt()
                
                # Log the claims for debugging
                log.debug(f"require_permissions: claims={claims}")
                
                user_perms = claims.get("perms", [])
                
                log.debug(f"require_permissions: user_perms={user_perms}, required={list(perms)}")
                
                if "*" in user_perms:
                    log.debug("require_permissions: Admin user (wildcard perm)")
                    return fn(*args, **kwargs)
                if not all(p in user_perms for p in perms):
                    log.warning(f"require_permissions: Permission denied for {claims.get('email')}. Required: {list(perms)}, Has: {user_perms}")
                    return jsonify({"error": "forbidden", "reason": "missing_permissions", "required": perms}), 403
                return fn(*args, **kwargs)
            except Exception as e:
                log.error(f"require_permissions: JWT verification failed: {str(e)}", exc_info=True)
                return jsonify({"error": "unauthorized", "reason": "JWT verification failed"}), 401
        return wrapper
    return decorator


STAFF_LEVELS = ["staff_l1", "staff_l2", "staff_l3"]

def is_staff(roles: Iterable[str]) -> bool:
    return any(r in STAFF_LEVELS for r in roles or [])