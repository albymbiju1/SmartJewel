from datetime import timedelta
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient
import structlog
import os

jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
log = structlog.get_logger()
mongo_client = None
db = None

def init_extensions(app):
    global mongo_client, db
    # Use shorter client timeouts for serverless environments
    # Vercel has strict timeout limits (10s for Hobby, 60s for Pro)
    is_serverless = app.config.get('ENV') == 'production' or os.getenv('VERCEL') or os.getenv('AWS_LAMBDA_FUNCTION_NAME')
    timeout_ms = 5000 if is_serverless else 10000
    
    try:
        mongo_client = MongoClient(
            app.config["MONGODB_URI"],
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            socketTimeoutMS=timeout_ms,
        )
        db = mongo_client[app.config["MONGO_DB_NAME"]]
        app.extensions['mongo_db'] = db
        print(f"MongoDB connected successfully to {app.config['MONGO_DB_NAME']}")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        print("Continuing without database - orders will not be persisted")
        db = None
        app.extensions['mongo_db'] = None

    # Expand CORS origins to include localhost/127.0.0.1 counterparts to avoid dev mismatches
    cfg_origins = app.config["CORS_ORIGINS"] or []
    expanded = set(cfg_origins)
    for origin in list(cfg_origins):
        try:
            from urllib.parse import urlparse
            p = urlparse(origin)
            if p.scheme and p.netloc:
                host = p.hostname
                port = f":{p.port}" if p.port else ""
                if host == "localhost":
                    expanded.add(f"{p.scheme}://127.0.0.1{port}")
                if host == "127.0.0.1":
                    expanded.add(f"{p.scheme}://localhost{port}")
        except Exception:
            pass

    cors.init_app(app,
                  supports_credentials=True,
                  origins=list(expanded),
                  allow_headers=["Content-Type", "Authorization"],
                  methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    jwt.init_app(app)
    # Apply default rate limit if provided
    default_limit = app.config.get("RATE_LIMIT_DEFAULT")
    if default_limit:
        app.config.setdefault("RATELIMIT_DEFAULT", default_limit)
    limiter.init_app(app)

    app.config["JWT_SECRET_KEY"] = app.config["JWT_SECRET"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=app.config["JWT_ACCESS_TTL_MIN"])
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=app.config["JWT_REFRESH_TTL_DAYS"])

    # Ensure global db is updated for all imports
    import app.extensions as _ext
    _ext.db = db

    structlog.configure(processors=[structlog.processors.JSONRenderer()])