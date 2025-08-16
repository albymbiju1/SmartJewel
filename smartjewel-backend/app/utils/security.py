from werkzeug.security import generate_password_hash, check_password_hash

def hash_password(raw: str) -> str:
    return generate_password_hash(raw, method="pbkdf2:sha256", salt_length=16)

def verify_password(raw: str, hashed: str) -> bool:
    return check_password_hash(hashed, raw)