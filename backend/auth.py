# backend/auth.py

import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt
from dotenv import load_dotenv
from database import users_col

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 7 * 24 * 60  # 7 days

# ------------------------
# Password Hashing
# ------------------------
def hash_password(password: str):
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(password: str, hashed: str):
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

# ------------------------
# JWT Token Generation
# ------------------------
def create_token(user_id: str):
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"user_id": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        return None
