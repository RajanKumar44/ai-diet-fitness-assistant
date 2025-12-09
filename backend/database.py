# backend/database.py

import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "fitness_app")

if not MONGO_URI:
    raise Exception("❌ MONGODB_URI missing in .env file")

# MongoDB client
client = MongoClient(MONGO_URI)

# Select database
db = client[DB_NAME]

# Collections
users_col = db["users"]
progress_col = db["daily_progress"]
history_col = db["history"]
daily_logs_col = db["daily_logs"]

print("✅ MongoDB connected successfully!")
