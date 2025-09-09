import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    APP_ENV = os.getenv("APP_ENV")
    MONGODB_URI = os.getenv("MONGODB_URI")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ACCESS_TTL_MIN = int(os.getenv("JWT_ACCESS_TTL_MIN"))
    JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS"))
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS").split(",")]
    RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT")
    ADMIN_EMAILS = [e.strip().lower() for e in (os.getenv("ADMIN_EMAILS") or "").split(",") if e.strip()]
    

