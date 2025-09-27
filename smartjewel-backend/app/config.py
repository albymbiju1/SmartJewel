import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    APP_ENV = os.getenv("APP_ENV", "development")
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "smartjewel")
    JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this-in-production")
    JWT_ACCESS_TTL_MIN = int(os.getenv("JWT_ACCESS_TTL_MIN", "60"))
    JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))
    CORS_ORIGINS = [o.strip() for o in (os.getenv("CORS_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173").split(",")]
    RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "100 per hour")
    ADMIN_EMAILS = [e.strip().lower() for e in (os.getenv("ADMIN_EMAILS") or "admin@smartjewel.com").split(",") if e.strip()]
    GOLDAPI_KEY = os.getenv("GOLDAPI_KEY", "your-gold-api-key-here")
    # Enable/disable APScheduler background jobs
    SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() in ("1", "true", "yes", "on")
    

