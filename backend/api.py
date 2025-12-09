from database import users_col, progress_col, history_col, daily_logs_col
from fastapi import FastAPI ,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Any, Dict, List
from auth import hash_password, verify_password, create_token, decode_token
from database import users_col
from fastapi import HTTPException
from datetime import datetime, date
from bson import ObjectId
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
from pydantic import BaseModel
from typing import Optional


import os

from utils.fitness_generator import (
    generate_workout_plan,
    generate_diet_plan,
    generate_advanced_fitness_plan,
)
from utils.calories import estimate_calories
from utils.ai_recommender import get_ai_recommendation
from utils.ai_chat import chat_with_coach
from utils.exporter import create_summary_pdf

app = FastAPI()
security = HTTPBearer()

# --- DATA SCHEMA FOR PROFILE UPDATE ---
class ProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None      # Backend field
    weight_kg: Optional[float] = None   # Frontend field alias
    height: Optional[float] = None      # Backend field
    height_cm: Optional[float] = None   # Frontend field alias
    gender: Optional[str] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None

def serialize_user(user):
    user["_id"] = str(user["_id"])   # Convert ObjectId → string
    return user

# =========================
# STATIC FILES: PDF EXPORTS
# =========================
# "exports" folder ko /static URL ke through serve karna
# PDF agar "exports/User_Fitness_Report.pdf" me banta hai,
# to URL hoga: http://localhost:8000/static/User_Fitness_Report.pdf
app.mount("/static", StaticFiles(directory="exports"), name="static")



# ------------------------
# Enable CORS
# ------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"]

)

@app.get("/db-test")
def test_db():
    try:
        count = users_col.count_documents({})
        return {"status": "success", "users_in_db": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}



@app.post("/auth/register")
def register(user: dict):
    # Check if email exists
    if users_col.find_one({"email": user["email"]}):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(user["password"])

    new_user = {
        "name": user["name"],
        "email": user["email"],
        "password": hashed,
        "age": user["age"],
        "gender": user["gender"],
        "height": user["height"],
        "weight": user["weight"],
        "goal": user["goal"],
        "activity_level": user.get("activity_level", "sedentary"),
        "created_at": datetime.utcnow()
    }

    users_col.insert_one(new_user)

    return {"message": "User registered successfully"}



@app.post("/auth/login")
def login(data: dict):
    user = users_col.find_one({"email": data["email"]})

    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    if not verify_password(data["password"], user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    token = create_token(str(user["_id"]))

    return {
        "message": "Login successful",
        "token": token,
        "user_id": str(user["_id"])
    }


from fastapi import Header, HTTPException


# ==========================================
# 1. SECURITY DEPENDENCY (The "Guard")
# ==========================================
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    decoded = decode_token(token)
    
    if not decoded or "user_id" not in decoded:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    try:
        user_id = ObjectId(decoded["user_id"])
        user = users_col.find_one({"_id": user_id})
    except:
        raise HTTPException(status_code=401, detail="Invalid user ID format")

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return serialize_user(user)


# ==========================================
# 2. GET USER PROFILE (Uses Dependency)
# ==========================================
@app.get("/auth/me")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    # 1. Profile Data lo
    current_user.pop("password", None)
    
    # 2. Aaj ki Date nikalo (YYYY-MM-DD format)
    today_str = str(date.today())
    user_id = current_user["_id"]

    # 3. Database check karo: Kya aaj ka koi data hai?
    today_log = daily_logs_col.find_one({
        "user_id": ObjectId(user_id),
        "date": today_str
    })

    # 4. Agar data hai to wo return karo, nahi to 0 (Auto Reset logic yahi hai)
    current_progress = {
        "calories": today_log["total_calories"] if today_log else 0,
        "food_items": today_log["food_items"] if today_log else [],
        # Future me workout status bhi yahan add kar sakte hain
    }
    # 5. Last session snapshot (diet/workout/advice/chat)
    last_session = current_user.get("last_session", {})

    return {
        "user": current_user,
        "today_progress": current_progress,
        "last_session": last_session,
    }

    

# ==========================================
# 3. SAVE PROFILE SECURELY (Uses Dependency)
# ==========================================
@app.post("/save-profile")
def save_profile(data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """
    Ab ye function tabhi chalega jab token valid hoga.
    Hume frontend se User ID bhejne ki jarurat nahi, 
    token se hi 'current_user' mil jayega.
    """
    user_id = current_user["_id"]

    # Database update query
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": data}
    )

    return {"status": "success", "message": "Profile saved to Database", "profile": data}

# ==========================================
# 4. UPDATE PROFILE ROUTE (PUT) - NEW ADDITION
# ==========================================
@app.put("/auth/update-profile")
def update_profile(profile_data: ProfileUpdateSchema, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]

    # 1. Pydantic model ko dict me convert karo (sirf jo values aayi hain unhe lo)
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}

    # 2. Data Mapping (Frontend vs Backend names fix)
    # Agar frontend 'weight_kg' bhejta hai, to usse DB ke 'weight' field me save karo
    if "weight_kg" in update_data:
        update_data["weight"] = update_data.pop("weight_kg")
    
    # Agar frontend 'height_cm' bhejta hai, to usse DB ke 'height' field me save karo
    if "height_cm" in update_data:
        update_data["height"] = update_data.pop("height_cm")

    if not update_data:
        return {"message": "No data provided to update"}

    # 3. MongoDB Update Query
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    # 4. Updated User ko wapas fetch karo (Confirmation ke liye)
    updated_user = users_col.find_one({"_id": ObjectId(user_id)})
    
    # Password remove karo response se
    if updated_user:
        updated_user["_id"] = str(updated_user["_id"])
        updated_user.pop("password", None)

    return {"message": "Profile updated successfully", "user": updated_user}

# ==========================================
# 5. GET WEEKLY HISTORY (Chart Data)
# ==========================================
from datetime import timedelta

@app.get("/history/weekly")
def get_weekly_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    today = date.today()
    
    # Pichle 7 din ka data store karne ke liye array (Mon-Sun)
    # Default sab 0
    weekly_data = [0] * 7 
    
    # Database se pichle 7 din ke logs nikalo
    start_date = str(today - timedelta(days=7))
    
    logs = daily_logs_col.find({
        "user_id": ObjectId(user_id),
        "date": {"$gte": start_date} # Aaj se 7 din pehle tak
    })

    # Data ko array mein bharo
    for log in logs:
        log_date = datetime.strptime(log["date"], "%Y-%m-%d").date()
        # Monday = 0, Sunday = 6
        day_index = log_date.weekday()
        weekly_data[day_index] = log["total_calories"]

    return {"weekly_calories": weekly_data}

# ------------------------
# ROOT / HEALTH CHECK
# ------------------------
@app.get("/")
def home() -> Dict[str, Any]:
    return {"status": "ok", "message": "AI Fitness FastAPI backend is running"}

@app.get("/history/list")
def get_history_list(current_user: dict = Depends(get_current_user)):
    uid = ObjectId(current_user["_id"])

    records = list(history_col.find({"user_id": uid}).sort("date", -1))

    clean_records = []
    for r in records:
        r["_id"] = str(r.get("_id"))
        r["user_id"] = str(r.get("user_id"))

        # Convert date field
        if "date" in r:
            r["date"] = str(r["date"])

        # Convert inside chat history
        if "chat_history" in r:
            for item in r["chat_history"]:
                if "_id" in item:
                    item["_id"] = str(item["_id"])

        clean_records.append(r)

    return {"history": clean_records}


from fastapi import Body

@app.post("/history/rename")
def rename_history(data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    history_id = data.get("history_id")
    new_title = (data.get("title") or "").strip()

    if not history_id or not new_title:
        raise HTTPException(status_code=400, detail="history_id and title are required")

    result = history_col.update_one(
        {"_id": ObjectId(history_id), "user_id": ObjectId(current_user["_id"])},
        {"$set": {"title": new_title}}
    )

    return {"success": result.modified_count == 1}

@app.post("/history/delete")
def delete_history(data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    history_id = data.get("history_id")
    if not history_id:
        raise HTTPException(status_code=400, detail="history_id is required")

    result = history_col.delete_one(
        {"_id": ObjectId(history_id), "user_id": ObjectId(current_user["_id"])}
    )

    return {"success": result.deleted_count == 1}


# ------------------------
# WORKOUT PLAN API
# ------------------------
@app.post("/workout")
def workout_api(user: Dict[str, Any]) -> Dict[str, Any]:

    user = dict(user)

    if not user.get("goal"):
        user["goal"] = "maintenance"

    if not user.get("days_per_week"):
        user["days_per_week"] = 4

    if not user.get("experience"):
        user["experience"] = "beginner"

    equipment = (user.get("equipment") or "").lower()

    if not user.get("location"):
        if "gym" in equipment:
            user["location"] = "gym"
        else:
            user["location"] = "home"

    plan = generate_workout_plan(user)

    import json as _json
    pretty_text = _json.dumps(plan, indent=2, ensure_ascii=False)

    return {
        "success": True,
        "plan_text": pretty_text,
        "workout_plan": plan,
    }


# ------------------------
# DIET PLAN API
# ------------------------
@app.post("/diet")
def diet_api(user: Dict[str, Any]) -> Dict[str, Any]:

    user = dict(user)

    # Activity level ka safe default
    user.setdefault("activity_level", "moderately active")

    # Agar frontend se food_preference aaya hai to usko respect karo,
    # warna hi "veg" default rakho
    food_pref = (user.get("food_preference") or "").strip().lower()
    if not food_pref:
        food_pref = "veg"

    user["food_preference"] = food_pref

    plan = generate_diet_plan(user)

    import json as _json
    pretty_text = _json.dumps(plan, indent=2, ensure_ascii=False)

    return {
        "success": True,
        "plan_text": pretty_text,
        "diet_plan": plan,
    }



# ------------------------
# ADVANCED PLAN API
# ------------------------
@app.post("/advanced-plan")
def advanced_plan_api(user: Dict[str, Any]) -> Dict[str, Any]:

    result = generate_advanced_fitness_plan(user)

    advanced = result.get("advanced_plan", {}) if isinstance(result, dict) else {}
    workout_block = advanced.get("Workout Plan")
    diet_block = advanced.get("Diet Plan")

    return {
        "success": True,
        "workout_json": workout_block,
        "diet_json": diet_block,
        "meta": result,
    }


# ------------------------
# CALORIES API
# ------------------------
@app.post("/calories")
def calories_api(body: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    # 1. AI se Calories Estimate karo
    food_text = body.get("food_text", "")
    estimated_total, details = estimate_calories(food_text)

    # 2. Aaj ki Date aur User ID nikalo
    today_str = str(date.today())
    user_id = current_user["_id"]

    # 3. Database Update Logic (Upsert)
    # Agar aaj ka record hai, to update karo. Agar nahi hai, to naya banao.
    daily_logs_col.update_one(
        {
            "user_id": ObjectId(user_id),
            "date": today_str
        },
        {
            "$inc": {"total_calories": estimated_total}, # Total me add karo
            "$push": { # List me naya item jodo
                "food_items": {
                    "item": food_text,
                    "calories": estimated_total,
                    "time": datetime.utcnow()
                }
            },
            "$setOnInsert": { # Agar naya document ban raha hai to ye fields set karo
                "user_id": ObjectId(user_id),
                "date": today_str,
                "created_at": datetime.utcnow()
            }
        },
        upsert=True # Magic Flag: Record nahi hoga to naya bana dega (24hr Reset Logic)
    )

    # 4. Updated Total wapas bhejo taaki UI turant update ho jaye
    updated_log = daily_logs_col.find_one({"user_id": ObjectId(user_id), "date": today_str})
    
    return {
        "success": True, 
        "total": updated_log["total_calories"], 
        "details": details,
        "message": "Saved to Database"
    }


# ------------------------
# AI RECOMMENDATION API
# ------------------------
@app.post("/recommendation")
def recommendation_api(user: Dict[str, Any]) -> Dict[str, Any]:

    name = user.get("name") or "Friend"
    age = user.get("age") or 0
    weight = user.get("weight_kg") or 0
    height = user.get("height_cm") or 0
    gender = (user.get("gender") or "").lower() or "unspecified"
    goal = user.get("goal") or "general fitness"
    activity = user.get("activity_level") or "moderate"
    latest_calories = user.get("last_calories") or 0

    advice = get_ai_recommendation(
        name, age, weight, height, gender, goal, activity, latest_calories
    )

    return {"success": True, "advice": advice}


# ------------------------
# AI CHAT API
# ------------------------
@app.post("/chat")
def chat_api(body: Dict[str, Any]) -> Dict[str, Any]:

    message = body.get("message") or ""
    history = body.get("history") or []

    if message:
        history.append({"role": "user", "content": message})

    reply = chat_with_coach(history)

    return {"success": True, "reply": reply}


@app.post("/save-summary")
def save_summary_only(body: Dict[str, Any], current_user: dict = Depends(get_current_user)):

    user_id = current_user["_id"]

    record = {
        "user_id": ObjectId(user_id),
        "username": current_user["name"],
        "date": datetime.utcnow(),
        "calories": body.get("calories", 0),
        "diet_plan": body.get("diet_plan", {}),
        "workout_plan": body.get("workout_plan", {}),
        "ai_advice": body.get("ai_advice", ""),
        "chat_history": body.get("chat_history", []),
    }

    # Save to DB
    history_col.insert_one(record)

    # Update last session
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"last_session": record}}
    )

    return {"success": True, "message": "Summary saved successfully"}

# ------------------------
# EXPORT SUMMARY TO PDF
# ------------------------

@app.post("/export-summary")
def export_summary(request: Request, body: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    
    # 1. User ka data token se nikala (Secure)
    user_id = current_user["_id"]
    username = current_user["name"]

    # 2. Data prepare kiya
    record = {
        "user_id": ObjectId(user_id),
        "username": username,
        "date": datetime.utcnow(),
        "calories": body.get("calories", 0),
        "diet_plan": body.get("diet_plan", {}),
        "workout_plan": body.get("workout_plan", {}),
        "ai_advice": body.get("ai_advice", ""),
        "chat_history": body.get("chat_history", []),
    }

    # 3. MongoDB ke 'history' collection me save kiya
    history_col.insert_one(record)

    # 3B. 🔥 User document me "last_session" update karo
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "last_session": {
                    "calories": record["calories"],
                    "diet_plan": record["diet_plan"],
                    "workout_plan": record["workout_plan"],
                    "ai_advice": record["ai_advice"],
                    "chat_history": record["chat_history"],
                    "saved_at": datetime.utcnow(),
                }
            }
        }
    )

    # 4. PDF Generate kiya (Ye logic same rahega)
    pdf_path = create_summary_pdf(
        username=username,
        calories=record["calories"],
        diet_plan=record["diet_plan"],
        workout_plan=record["workout_plan"],
        ai_advice=record["ai_advice"],
        chat_history=record["chat_history"],
    )

    filename = os.path.basename(pdf_path)
    
    # Auto-detect URL
    base_url = str(request.base_url).rstrip("/")

    return {
        "success": True,
        "pdf_url": f"{base_url}/static/{filename}",
        "message": "Saved to Database & PDF Generated"
    }

