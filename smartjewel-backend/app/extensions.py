from datetime import timedelta
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient
import structlog

jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
log = structlog.get_logger()
mongo_client = None
db = None

def init_extensions(app):
    global mongo_client, db
    mongo_client = MongoClient(app.config["MONGODB_URI"])
    db = mongo_client[app.config["MONGO_DB_NAME"]]
    app.extensions['mongo_db'] = db

    cors.init_app(app, supports_credentials=False, origins=app.config["CORS_ORIGINS"])
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