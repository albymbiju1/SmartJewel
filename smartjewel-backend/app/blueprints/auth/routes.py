from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from marshmallow import ValidationError
from app.extensions import limiter, log
from flask import current_app
from .schemas import LoginSchema, RegistrationSchema, StaffCreateSchema
from app.utils.security import verify_password, hash_password
from app.utils.authz import require_roles
from datetime import timedelta
from app.utils.mailer import send_email
from app.utils.email_templates import otp_email, reset_password_email
from pymongo.errors import DuplicateKeyError
try:
    import firebase_admin
    from firebase_admin import auth as fb_auth
except Exception:  # pragma: no cover
    firebase_admin = None
    fb_auth = None

bp = Blueprint("auth", __name__, url_prefix="/auth")
login_schema = LoginSchema()
registration_schema = RegistrationSchema()
staff_create_schema = StaffCreateSchema()

@limiter.limit("5 per minute")
@bp.post("/register")
def register():
    db = current_app.extensions['mongo_db']
    try:
        data = registration_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    existing = db.users.find_one({"email": data["email"].lower()})
    if existing:
        # If the account exists but is not verified, guide client to OTP flow
        if existing.get("status") != "active":
            return jsonify({"error": "account_unverified"}), 409
        return jsonify({"error": "email_in_use"}), 409
    
    # Create Firebase user if Firebase is available
    firebase_uid = None
    if fb_auth is not None:
        try:
            # Initialize Firebase app if not already initialized
            try:
                firebase_admin.get_app()
            except ValueError:
                _initialize_firebase_app()
            
            # Create Firebase user
            firebase_user = fb_auth.create_user(
                email=data["email"].lower(),
                password=data["password"],
                display_name=data["name"]
            )
            firebase_uid = firebase_user.uid
            log.info("auth.register.firebase_user_created", firebase_uid=firebase_uid, email=data["email"])
        except Exception as e:
            log.error("auth.register.firebase_user_creation_failed", error=str(e), email=data["email"])
            # Continue with MongoDB user creation even if Firebase fails
            # This ensures the registration doesn't fail completely
    
    # Assign default role (customer) by looking up roles collection
    role_doc = db.roles.find_one({"role_name": "Customer"})
    if not role_doc:
        return jsonify({"error": "role_not_found"}), 500
    
    # Prepare OTP
    import random
    cfg = current_app.config
    otp_length = int(cfg.get("OTP_LENGTH", 6))
    ttl_minutes = int(cfg.get("OTP_TTL_MINUTES", 10))
    otp_code = ''.join(str(random.randint(0, 9)) for _ in range(otp_length))

    user_doc = {
        "full_name": data["name"],
        "email": data["email"].lower(),
        "phone_number": data["phone"],
        "password_hash": hash_password(data["password"]),
        "role": {
            "_id": role_doc["_id"],
            "role_name": role_doc["role_name"]
        },
        "status": "pending_verification",
        "created_at": _now(db),
        "otp": {
            "code_hash": hash_password(otp_code),
            "expires_at": _now(db) + timedelta(minutes=ttl_minutes),
            "attempts": 0
        }
    }

    # Add Firebase UID if available
    if firebase_uid:
        user_doc["firebase_uid"] = firebase_uid
        user_doc["uid"] = firebase_uid  # Also store as uid for compatibility

    try:
        inserted = db.users.insert_one(user_doc)
    except DuplicateKeyError:
        # Email unique index caught a race; return 409 consistent with pre-check
        return jsonify({"error": "email_in_use"}), 409

    log.info("auth.register.user_created", user_id=str(inserted.inserted_id), email=data["email"], firebase_uid=firebase_uid)

    # Send OTP email
    try:
        subject, text_body, html_body = otp_email(data["name"], otp_code, ttl_minutes)
        send_email(user_doc["email"], subject, text_body, html_body)
        log.info("auth.register.otp_sent", email=user_doc["email"]) 
    except Exception as e:
        log.error("auth.register.otp_send_failed", email=user_doc["email"], error=str(e))

    return jsonify({
        "id": str(inserted.inserted_id),
        "email": user_doc["email"],
        "full_name": user_doc["full_name"],
        "requires_verification": True
    }), 201


# Role -> default permissions (extend as system grows)
ROLE_PERMISSIONS = {
    "admin": ["*"],
    # Read-only inventory for basic staff
    "staff_l1": ["inventory.read"],
    # Can read and update limited fields
    "staff_l2": ["inventory.read", "inventory.update"],
    # Inventory Staff Type 3: can add/update stock, assign tags, and track flow
    "staff_l3": [
        "inventory.read",
        "inventory.create",
        "inventory.update",
        "inventory.delete",
        "inventory.flow",
        "inventory.tag.assign",
        "inventory.location.read"
    ],
    "customer": [],
}

def _expand_permissions(roles):
    perms = set()
    for r in roles:
        perms.update(ROLE_PERMISSIONS.get(r, []))
    return list(perms)

@limiter.limit("10 per minute")
@bp.post("/staff")
@require_roles("admin")
def create_staff():
    """Admin creates a staff member (level determines role)."""
    db = current_app.extensions['mongo_db']
    try:
        data = staff_create_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    email_l = data["email"].lower()
    if db.users.find_one({"email": email_l}):
        return jsonify({"error": "email_in_use"}), 409
    role = data["level"]
    role_doc = db.roles.find_one({"role_name": role})
    roles = [role]
    perms = _expand_permissions(roles)
    user_doc = {
        "email": email_l,
        "name": data["name"],
        "password_hash": hash_password(data["password"]),
        "role": {"_id": str(role_doc["_id"]), "role_name": role} if role_doc else None,
        "roles": roles,
        "permissions": perms,
        "is_active": True,
        "branch_id": data.get("branch_id"),
    }
    ins = db.users.insert_one(user_doc)
    return jsonify({"id": str(ins.inserted_id), "email": email_l, "roles": roles, "permissions": perms}), 201

@limiter.limit("10 per minute")
@bp.post("/login")
def login():
    db = current_app.extensions['mongo_db']
    try:
        data = login_schema.load(request.get_json() or {})
    except ValidationError as err:
        log.warning("auth.login.validation_failed", details=err.messages)
        return jsonify({"error": "validation_failed", "details": err.messages}), 400
    
    user = db.users.find_one({"email": data["email"].lower()})
    if not user or not verify_password(data["password"], user["password_hash"]):
        log.info("auth.login.invalid_credentials", email=data.get("email"))
        return jsonify({"error": "invalid_credentials"}), 401
    if user.get("status") != "active":
        return jsonify({"error": "account_unverified"}), 403

    # Fetch full role info
    role_doc = db.roles.find_one({"_id": user["role"]["_id"]}) if user.get("role") else None
    identity = str(user["_id"])
    
    # Convert role info to JSON-serializable format
    role_info = {}
    if user.get("role"):
        role_info = {
            "_id": str(user["role"]["_id"]),
            "role_name": user["role"]["role_name"]
        }
    
    roles_claim = user.get("roles") or ([role_doc["role_name"]] if role_doc and role_doc.get("role_name") else [])
    perms_claim = role_doc["permissions"] if role_doc and role_doc.get("permissions") else user.get("permissions", []) or []

    claims = {
        "role": role_info,
        "roles": roles_claim,
        "perms": perms_claim,
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "firebase_uid": user.get("firebase_uid"),
    }
    access = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)

    safe_user = {
        "id": identity,
        "email": user["email"],
        "full_name": user.get("full_name"),
        "role": role_info,
        "roles": roles_claim,
        "perms": perms_claim,
    }
    return jsonify({"access_token": access, "refresh_token": refresh, "user": safe_user}), 200

@bp.get("/me")
@jwt_required()
def me():
    claims = get_jwt()
    return jsonify({
        "user_id": get_jwt_identity(),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "roles": claims.get("roles", []),
        "branch_id": claims.get("branch_id"),
        "perms": claims.get("perms", []),
    }), 200


@limiter.limit("5 per minute")
@bp.post("/verify-otp")
def verify_otp():
    db = current_app.extensions['mongo_db']
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    otp = (payload.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"error": "validation_failed", "details": {"email": ["Email is required"], "otp": ["OTP is required"]}}), 400

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "not_found"}), 404
    if user.get("status") == "active":
        return jsonify({"message": "already_verified"}), 200

    otp_info = (user or {}).get("otp") or {}
    if not otp_info:
        return jsonify({"error": "no_otp"}), 400

    # Check expiration
    now = _now(db)
    if otp_info.get("expires_at") and now > otp_info["expires_at"]:
        return jsonify({"error": "otp_expired"}), 400

    # Check attempts
    max_attempts = int(current_app.config.get("OTP_MAX_ATTEMPTS", 5))
    attempts = int(otp_info.get("attempts", 0))
    if attempts >= max_attempts:
        return jsonify({"error": "otp_attempts_exceeded"}), 429

    # Verify code
    if not verify_password(otp, otp_info.get("code_hash", "")):
        db.users.update_one({"_id": user["_id"]}, {"$inc": {"otp.attempts": 1}})
        return jsonify({"error": "otp_invalid"}), 400

    # Success: mark user active and clear otp
    db.users.update_one({"_id": user["_id"]}, {"$set": {"status": "active"}, "$unset": {"otp": ""}})
    return jsonify({"message": "verified"}), 200


@limiter.limit("3 per minute")
@bp.post("/request-otp")
def request_otp():
    import random
    db = current_app.extensions['mongo_db']
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "validation_failed", "details": {"email": ["Email is required"]}}), 400

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "not_found"}), 404

    if user.get("status") == "active":
        return jsonify({"message": "already_verified"}), 200

    cfg = current_app.config
    otp_length = int(cfg.get("OTP_LENGTH", 6))
    ttl_minutes = int(cfg.get("OTP_TTL_MINUTES", 10))
    otp_code = ''.join(str(random.randint(0, 9)) for _ in range(otp_length))

    db.users.update_one({"_id": user["_id"]}, {
        "$set": {
            "otp.code_hash": hash_password(otp_code),
            "otp.expires_at": _now(db) + timedelta(minutes=ttl_minutes),
            "otp.attempts": 0
        }
    })

    try:
        subject, text_body, html_body = otp_email(user.get("full_name") or "there", otp_code, ttl_minutes)
        send_email(email, subject, text_body, html_body)
        log.info("auth.request_otp.sent", email=email)
    except Exception as e:
        log.error("auth.request_otp.send_failed", email=email, error=str(e))

    return jsonify({"message": "otp_sent"}), 200

@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    claims = get_jwt()
    identity = claims["sub"]
    
    # Ensure role info is JSON-serializable
    role_info = claims.get("role", {})
    if role_info:
        # Make sure _id is a string, not ObjectId
        role_id = role_info.get("_id")
        if role_id:
            # Ensure it's a string even if it's already converted
            role_info = {
                "_id": str(role_id),
                "role_name": role_info.get("role_name", "")
            }
        else:
            role_info = {
                "_id": "",
                "role_name": role_info.get("role_name", "")
            }
    
    # Ensure all claims are JSON serializable
    safe_claims = {
        "role": role_info,
        "roles": claims.get("roles", []),
        "perms": claims.get("perms", []),
        "branch_id": claims.get("branch_id"),
        "email": claims.get("email"),
        "name": claims.get("name"),
        "firebase_uid": claims.get("firebase_uid"),
    }
    
    access = create_access_token(identity=identity, additional_claims=safe_claims)
    return jsonify({"access_token": access}), 200

@bp.post("/logout")
@jwt_required()
def logout():
    # Stateless JWT: client drops tokens
    return jsonify({"message": "logged_out"}), 200


@limiter.limit("10 per minute")
@bp.post("/resolve-user")
def resolve_user_by_email():
    """Resolve minimal user info (role, permissions) by email for social logins.

    Returns only non-sensitive fields. Rate limited.
    """
    db = current_app.extensions['mongo_db']
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        log.warning("auth.resolve_user.missing_email")
        return jsonify({"error": "validation_failed", "details": {"email": ["Email is required"]}}), 400

    user = db.users.find_one({"email": email, "status": "active"})
    if not user:
        # Not found → treat as customer on client
        log.info("auth.resolve_user.not_found", email=email)
        return jsonify({"found": False}), 200

    # Fetch role document if present
    role_info = {}
    perms_claim = []
    roles_claim = []
    role_doc = None
    if user.get("role"):
        role_doc = db.roles.find_one({"_id": user["role"]["_id"]})
        role_info = {
            "_id": str(user["role"]["_id"]),
            "role_name": user["role"].get("role_name")
        }
        if role_doc and role_doc.get("role_name"):
            roles_claim = [role_doc["role_name"]]
        if role_doc and role_doc.get("permissions"):
            perms_claim = role_doc["permissions"]
    else:
        roles_claim = user.get("roles", [])
        perms_claim = user.get("permissions", [])

    return jsonify({
        "found": True,
        "user": {
            "id": str(user.get("_id")),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "role": role_info,
            "roles": roles_claim,
            "perms": perms_claim,
        }
    }), 200


@limiter.limit("10 per minute")
@bp.post("/firebase-login")
def firebase_login():
    """Exchange a Firebase ID token for backend JWTs, mapped by email to existing user.

    This links Google sign-ins to the same Mongo user (by email), ensuring the same
    identity/claims and consistent data access.
    """
    if fb_auth is None:
        log.error("auth.firebase_login.firebase_not_configured")
        return jsonify({"error": "firebase_not_configured"}), 500

    db = current_app.extensions['mongo_db']
    body = request.get_json() or {}
    id_token = body.get("id_token")
    if not id_token:
        log.warning("auth.firebase_login.missing_id_token")
        return jsonify({"error": "validation_failed", "details": {"id_token": ["ID token is required"]}}), 400

    # Firebase app should already be initialized, but if not, initialize it
    try:
        # Try to get the default app, if it doesn't exist, initialize it
        firebase_admin.get_app()
    except ValueError:
        # App doesn't exist, initialize it
        try:
            from firebase_admin import credentials
            import os, json

            # 1) Prefer GOOGLE_APPLICATION_CREDENTIALS if provided (points to JSON file)
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if creds_path and os.path.exists(creds_path):
                # Try to read project_id from the JSON, fallback to env
                project_id_env = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                try:
                    with open(creds_path, "r", encoding="utf-8") as fh:
                        sa_data = json.load(fh)
                        project_id_file = sa_data.get("project_id")
                except Exception:
                    project_id_file = None
                project_id_opt = project_id_file or project_id_env
                cred = credentials.Certificate(creds_path)
                if project_id_opt:
                    log.info("auth.firebase_login.init_with_env_path", project_id=project_id_opt)
                    firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
                else:
                    log.info("auth.firebase_login.init_with_env_path_no_project")
                    firebase_admin.initialize_app(cred)
            else:
                # Try common paths if GOOGLE_APPLICATION_CREDENTIALS not set
                possible_paths = [
                    os.path.join(os.getcwd(), "service-account.json"),
                    os.path.join(os.path.dirname(__file__), "..", "..", "service-account.json"),
                    os.path.join(os.path.dirname(__file__), "..", "..", "..", "service-account.json"),
                ]
                creds_path = None
                for path in possible_paths:
                    abs_path = os.path.abspath(path)
                    if os.path.exists(abs_path):
                        creds_path = abs_path
                        break
                
                if creds_path:
                    log.info("auth.firebase_login.found_service_account", path=creds_path)
                    try:
                        with open(creds_path, "r", encoding="utf-8") as fh:
                            sa_data = json.load(fh)
                            project_id_file = sa_data.get("project_id")
                    except Exception:
                        project_id_file = None
                    project_id_env = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                    project_id_opt = project_id_file or project_id_env
                    log.info("auth.firebase_login.init_with_service_account", project_id=project_id_opt, file=creds_path)
                    cred = credentials.Certificate(creds_path)
                    if project_id_opt:
                        firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
                    else:
                        firebase_admin.initialize_app(cred)
                else:
                    # 2) Try full JSON blob in env (FIREBASE_CREDENTIALS_JSON)
                    creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
                    if creds_json:
                        try:
                            data = json.loads(creds_json)
                            # Normalize possible \n in private_key
                            if isinstance(data, dict) and data.get("private_key"):
                                data["private_key"] = data["private_key"].replace("\\n", "\n")
                            cred = credentials.Certificate(data)
                            project_id_opt = data.get("project_id") or os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                            log.info("auth.firebase_login.init_with_env_json", project_id=project_id_opt)
                            if project_id_opt:
                                firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
                            else:
                                firebase_admin.initialize_app(cred)
                        except Exception as e:
                            raise RuntimeError(f"Invalid FIREBASE_CREDENTIALS_JSON: {e}")
                    else:
                        # 3) Fallback to split envs (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
                        project_id = os.getenv("FIREBASE_PROJECT_ID")
                        client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
                        private_key = os.getenv("FIREBASE_PRIVATE_KEY")
                        if project_id and client_email and private_key:
                            private_key = private_key.replace("\\n", "\n")
                            cred = credentials.Certificate({
                                "type": "service_account",
                                "project_id": project_id,
                                "private_key_id": "",
                                "private_key": private_key,
                                "client_email": client_email,
                                "client_id": "",
                                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                                "token_uri": "https://oauth2.googleapis.com/token",
                                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}"
                            })
                            log.info("auth.firebase_login.init_with_env_vars", project_id=project_id)
                            firebase_admin.initialize_app(cred, {"projectId": project_id})
                        else:
                            # 4) Last resort: Application Default Credentials (may work in GCP)
                            adc_project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
                            log.warning("auth.firebase_login.init_with_adc", project_id=adc_project)
                            if adc_project:
                                firebase_admin.initialize_app(options={"projectId": adc_project})
                            else:
                                firebase_admin.initialize_app()
        except Exception as exc:  # pragma: no cover
            log.error("auth.firebase_login.firebase_init_failed", error=str(exc))
            return jsonify({"error": "firebase_init_failed", "details": str(exc)}), 500

    try:
        # First try with revocation check
        try:
            # In local development, disable timestamp checking to avoid clock skew issues
            is_local = os.getenv("APP_ENV", "development") == "development" or os.getenv("FLASK_ENV") == "development"
            
            if is_local:
                # Local: Skip revocation check and disable strict timestamp validation
                log.info("auth.firebase_login.local_mode", msg="Using lenient timestamp validation for local development")
                decoded = fb_auth.verify_id_token(id_token, check_revoked=False)
            else:
                # Production: Full validation
                decoded = fb_auth.verify_id_token(id_token, check_revoked=True)
        except fb_auth.RevokedIdTokenError as e:
            log.warning("auth.firebase_login.revoked_token", error=str(e))
            return jsonify({"error": "token_revoked", "details": str(e)}), 401
        except (fb_auth.InvalidIdTokenError, Exception) as first_attempt_error:
            # Try again without revocation check - sometimes this can interfere with verification
            log.warning("auth.firebase_login.verify_with_revoke_failed", error=str(first_attempt_error))
            try:
                decoded = fb_auth.verify_id_token(id_token, check_revoked=False)
                log.info("auth.firebase_login.verify_without_revoke_succeeded")
            except Exception as second_attempt_error:
                # Both attempts failed
                raise first_attempt_error  # Re-raise the first error for proper handling
    except fb_auth.ExpiredIdTokenError as e:
        log.warning("auth.firebase_login.expired_token", error=str(e))
        return jsonify({"error": "token_expired", "details": str(e)}), 401
    except fb_auth.InvalidIdTokenError as e:
        log.warning("auth.firebase_login.invalid_id_token", error=str(e), token_prefix=id_token[:50] if id_token else "")
        return jsonify({"error": "invalid_id_token", "details": str(e)}), 401
    except Exception as e:
        import traceback
        log.warning("auth.firebase_login.verify_failed", error=str(e), traceback=traceback.format_exc())
        return jsonify({"error": "verify_failed", "details": str(e)}), 401

    email = (decoded.get("email") or "").lower()
    name = decoded.get("name") or email.split('@')[0]
    if not email:
        log.warning("auth.firebase_login.email_missing_in_token")
        return jsonify({"error": "email_missing_in_token"}), 400

    firebase_uid = decoded.get("uid")

    # Try find by firebase_uid first
    user_by_fuid = db.users.find_one({"$or": [{"firebase_uid": firebase_uid}, {"uid": firebase_uid}]}) if firebase_uid else None
    user_by_email = db.users.find_one({"email": email})

    # Merge duplicates if both exist and are different
    if user_by_fuid and user_by_email and str(user_by_fuid["_id"]) != str(user_by_email["_id"]):
        primary = user_by_email  # prefer the email/password account as primary
        duplicate = user_by_fuid
        log.info("auth.firebase_login.merge_users", primary=str(primary["_id"]), duplicate=str(duplicate["_id"]))
        _merge_users(db, primary_id=primary["_id"], duplicate_id=duplicate["_id"]) 
        # reload primary after merge
        user = db.users.find_one({"_id": primary["_id"]})
    else:
        user = user_by_fuid or user_by_email

    if not user:
        # Determine default role: Admin if email in ADMIN_EMAILS, else Customer
        admin_emails = (current_app.config.get("ADMIN_EMAILS") or [])
        desired_role = "Admin" if email in admin_emails else "Customer"
        role_doc = db.roles.find_one({"role_name": desired_role})
        if not role_doc:
            # Attempt to auto-create minimal roles if missing to avoid 500s in fresh DB
            try:
                customer_role = db.roles.find_one({"role_name": "Customer"})
                if not customer_role:
                    db.roles.insert_one({"role_name": "Customer", "permissions": ["profile.read", "orders.read"]})
                    customer_role = db.roles.find_one({"role_name": "Customer"})
                admin_role = db.roles.find_one({"role_name": "Admin"})
                if not admin_role:
                    db.roles.insert_one({"role_name": "Admin", "permissions": ["*"]})
                    admin_role = db.roles.find_one({"role_name": "Admin"})
                role_doc = admin_role if desired_role == "Admin" else customer_role
            except Exception as e:
                log.error("auth.firebase_login.role_autocreate_failed", error=str(e))
                return jsonify({"error": "role_not_found"}), 500
        # New Google user: auto-activate (no OTP for Google login)
        user_doc = {
            "full_name": name,
            "email": email,
            "firebase_uid": firebase_uid,
            "uid": firebase_uid,
            "role": {"_id": str(role_doc["_id"]), "role_name": role_doc["role_name"]},
            "status": "active",
            "created_at": _now(db),
        }
        ins = db.users.insert_one(user_doc)
        log.info("auth.firebase_login.user_created", user_id=str(ins.inserted_id), email=email, auto_active=True)
        user = db.users.find_one({"_id": ins.inserted_id})
    else:
        # Ensure firebase_uid is stored on primary user
        if firebase_uid and not (user.get("firebase_uid") or user.get("uid")):
            db.users.update_one({"_id": user["_id"]}, {"$set": {"firebase_uid": firebase_uid, "uid": firebase_uid}})
            log.info("auth.firebase_login.attach_uid", user_id=str(user["_id"]))
        # Optionally elevate to Admin if listed and role isn't already Admin
        admin_emails = (current_app.config.get("ADMIN_EMAILS") or [])
        if email in admin_emails:
            try:
                if not (user.get("role") and user["role"].get("role_name") == "Admin"):
                    admin_role = db.roles.find_one({"role_name": "Admin"})
                    if admin_role:
                        db.users.update_one({"_id": user["_id"]}, {"$set": {"role": {"_id": str(admin_role["_id"]), "role_name": "Admin"}}})
                        log.info("auth.firebase_login.promote_admin", user_id=str(user["_id"]))
                        user = db.users.find_one({"_id": user["_id"]})
            except Exception:
                pass

    # Enforce verification for existing users before issuing tokens
    if user and user.get("status") != "active":
        # Auto-activate on Google login (no OTP required)
        db.users.update_one({"_id": user["_id"]}, {"$set": {"status": "active"}, "$unset": {"otp": ""}})
        user = db.users.find_one({"_id": user["_id"]})
        log.info("auth.firebase_login.auto_verified_google", email=user.get("email"))

    # Prepare role/claims similar to password login
    role_info = {}
    role_doc = None
    if user.get("role"):
        role_doc = db.roles.find_one({"_id": user["role"]["_id"]})
        role_info = {"_id": str(user["role"]["_id"]), "role_name": user["role"].get("role_name")}
    roles_claim = user.get("roles") or ([role_doc["role_name"]] if role_doc and role_doc.get("role_name") else [])
    perms_claim = role_doc["permissions"] if role_doc and role_doc.get("permissions") else user.get("permissions", [])

    identity = str(user["_id"])
    claims = {
        "role": role_info,
        "roles": roles_claim,
        "perms": perms_claim,
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "firebase_uid": user.get("firebase_uid") or user.get("uid"),
    }
    access = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)

    safe_user = {
        "id": identity,
        "email": user["email"],
        "full_name": user.get("full_name"),
        "role": role_info,
        "roles": roles_claim,
        "perms": perms_claim,
    }
    log.info("auth.firebase_login.success", user_id=identity, email=user.get("email"))
    return jsonify({"access_token": access, "refresh_token": refresh, "user": safe_user}), 200


def _now(db):
    # Use Mongo server time if available
    try:
        is_master = db.command("isMaster")
        return is_master.get("localTime")
    except Exception:
        from datetime import datetime
        return datetime.utcnow()


def _initialize_firebase_app():
    """Initialize Firebase Admin SDK with proper credentials."""
    if fb_auth is None:
        return
    
    try:
        from firebase_admin import credentials
        import os, json

        # 1) Prefer GOOGLE_APPLICATION_CREDENTIALS if provided (points to JSON file)
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            # Try to read project_id from the JSON, fallback to env
            project_id_env = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
            try:
                with open(creds_path, "r", encoding="utf-8") as fh:
                    sa_data = json.load(fh)
                    project_id_file = sa_data.get("project_id")
            except Exception:
                project_id_file = None
            project_id_opt = project_id_file or project_id_env
            cred = credentials.Certificate(creds_path)
            if project_id_opt:
                firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
            else:
                firebase_admin.initialize_app(cred)
        else:
            # Try common paths if GOOGLE_APPLICATION_CREDENTIALS not set
            possible_paths = [
                os.path.join(os.getcwd(), "service-account.json"),
                os.path.join(os.path.dirname(__file__), "..", "..", "service-account.json"),
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "service-account.json"),
            ]
            creds_path = None
            for path in possible_paths:
                abs_path = os.path.abspath(path)
                if os.path.exists(abs_path):
                    creds_path = abs_path
                    break
            
            if creds_path:
                log.info("auth.firebase_init.found_service_account", path=creds_path)
                try:
                    with open(creds_path, "r", encoding="utf-8") as fh:
                        sa_data = json.load(fh)
                        project_id_file = sa_data.get("project_id")
                except Exception:
                    project_id_file = None
                project_id_env = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                project_id_opt = project_id_file or project_id_env
                cred = credentials.Certificate(creds_path)
                if project_id_opt:
                    firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
                else:
                    firebase_admin.initialize_app(cred)
            else:
                # 2) Try full JSON blob in env (FIREBASE_CREDENTIALS_JSON)
                creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
                if creds_json:
                    try:
                        data = json.loads(creds_json)
                        # Normalize possible \n in private_key
                        if isinstance(data, dict) and data.get("private_key"):
                            data["private_key"] = data["private_key"].replace("\\n", "\n")
                        cred = credentials.Certificate(data)
                        project_id_opt = data.get("project_id") or os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                        if project_id_opt:
                            firebase_admin.initialize_app(cred, {"projectId": project_id_opt})
                        else:
                            firebase_admin.initialize_app(cred)
                    except Exception as e:
                        raise RuntimeError(f"Invalid FIREBASE_CREDENTIALS_JSON: {e}")
                else:
                    # 3) Fallback to split envs (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
                    project_id = os.getenv("FIREBASE_PROJECT_ID")
                    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
                    private_key = os.getenv("FIREBASE_PRIVATE_KEY")
                    if project_id and client_email and private_key:
                        private_key = private_key.replace("\\n", "\n")
                        cred = credentials.Certificate({
                            "project_id": project_id,
                            "client_email": client_email,
                            "private_key": private_key,
                            "type": "service_account",
                        })
                        firebase_admin.initialize_app(cred, {"projectId": project_id})
                    else:
                        # 4) Last resort: Application Default Credentials (may work in GCP)
                        adc_project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
                        if adc_project:
                            firebase_admin.initialize_app(options={"projectId": adc_project})
                        else:
                            firebase_admin.initialize_app()
    except Exception as exc:
        log.error("auth.firebase_init.failed", error=str(exc))
        raise exc


def _merge_users(db, primary_id, duplicate_id):
    """Merge duplicate user into primary.

    - Reassigns references in known collections from duplicate_id -> primary_id
    - Deletes duplicate user document
    """
    # Collections and fields referencing user IDs
    ref_updates = [
        ("stock_movements", "created_by"),
        ("tags", "assigned_by"),
    ]
    for coll, field in ref_updates:
        res = db[coll].update_many({field: duplicate_id}, {"$set": {field: primary_id}})
        log.info("auth.merge.ref_update", collection=coll, field=field, modified=res.modified_count)

    # Finally, remove duplicate user
    # Also update created_by_uid/assigned_by_uid if present
    primary = db.users.find_one({"_id": primary_id})
    duplicate = db.users.find_one({"_id": duplicate_id})
    p_uid = (primary or {}).get("firebase_uid")
    d_uid = (duplicate or {}).get("firebase_uid")
    if p_uid and d_uid and p_uid != d_uid:
        res1 = db.stock_movements.update_many({"created_by_uid": d_uid}, {"$set": {"created_by_uid": p_uid}})
        res2 = db.tags.update_many({"assigned_by_uid": d_uid}, {"$set": {"assigned_by_uid": p_uid}})
        log.info("auth.merge.uid_update", stock_movements=res1.modified_count, tags=res2.modified_count)

    db.users.delete_one({"_id": duplicate_id})
    log.info("auth.merge.duplicate_deleted", duplicate_id=str(duplicate_id))

@limiter.limit("3 per minute")
@bp.post("/request-password-reset")
def request_password_reset():
    db = current_app.extensions['mongo_db']
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()

    # Always respond success to avoid email enumeration
    user = db.users.find_one({"email": email}) if email else None
    if user:
        import random
        cfg = current_app.config
        otp_length = int(cfg.get("OTP_LENGTH", 6))
        ttl_minutes = int(cfg.get("OTP_TTL_MINUTES", 10))
        code = ''.join(str(random.randint(0, 9)) for _ in range(otp_length))
        db.users.update_one({"_id": user["_id"]}, {
            "$set": {
                "reset": {
                    "code_hash": hash_password(code),
                    "expires_at": _now(db) + timedelta(minutes=ttl_minutes),
                    "attempts": 0
                }
            }
        })
        try:
            name = user.get("full_name") or user.get("email")
            subject, text_body, html_body = reset_password_email(name, code, ttl_minutes)
            send_email(email, subject, text_body, html_body)
            log.info("auth.reset.request_sent", email=email)
        except Exception as e:
            log.error("auth.reset.request_send_failed", email=email, error=str(e))
    return jsonify({"message": "reset_sent"}), 200

@limiter.limit("3 per minute")
@bp.post("/reset-password")
def reset_password():
    db = current_app.extensions['mongo_db']
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    new_password = (payload.get("new_password") or "").strip()

    if not email or not code or not new_password:
        return jsonify({"error": "validation_failed", "details": {
            "email": ["Email is required"],
            "code": ["Code is required"],
            "new_password": ["New password is required"]
        }}), 400

    user = db.users.find_one({"email": email})
    if not user:
        # For security, respond success
        return jsonify({"message": "reset_success"}), 200

    reset_info = (user or {}).get("reset") or {}
    if not reset_info:
        return jsonify({"error": "no_reset"}), 400

    now = _now(db)
    if reset_info.get("expires_at") and now > reset_info["expires_at"]:
        return jsonify({"error": "reset_expired"}), 400

    max_attempts = int(current_app.config.get("OTP_MAX_ATTEMPTS", 5))
    attempts = int(reset_info.get("attempts", 0))
    if attempts >= max_attempts:
        return jsonify({"error": "reset_attempts_exceeded"}), 429

    if not verify_password(code, reset_info.get("code_hash", "")):
        db.users.update_one({"_id": user["_id"]}, {"$inc": {"reset.attempts": 1}})
        return jsonify({"error": "reset_invalid"}), 400

    # Update password and clear reset object
    db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(new_password), "status": "active"}, "$unset": {"reset": ""}})
    return jsonify({"message": "reset_success"}), 200