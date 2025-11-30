from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Any, Dict, List
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

import json

HISTORY_FILE = "data/user_history.json"

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return {}
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_history(data):
    with open(HISTORY_FILE, "w") as f:
        json.dump(data, f, indent=4)


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
    allow_headers=["*"],
)


# ------------------------
# ROOT / HEALTH CHECK
# ------------------------
@app.get("/")
def home() -> Dict[str, Any]:
    return {"status": "ok", "message": "AI Fitness FastAPI backend is running"}


# ------------------------
# SAVE PROFILE API
# ------------------------
@app.post("/save-profile")
def save_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    import json
    from pathlib import Path

    profile_path = Path("profile.json")
    profile_path.write_text(json.dumps(data, indent=4), encoding="utf-8")

    return {"status": "success", "message": "Profile saved", "profile": data}


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

    user.setdefault("activity_level", "moderately active")
    user.setdefault("food_preference", "veg")

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
def calories_api(body: Dict[str, Any]) -> Dict[str, Any]:

    food_text = body.get("food_text", "")
    total, details = estimate_calories(food_text)

    return {"success": True, "total": total, "details": details}


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


# ------------------------
# EXPORT SUMMARY TO PDF
# ------------------------
from fastapi import Request
@app.post("/export-summary")
def export_summary(body: Dict[str, Any]):
    username = body.get("username", "User")
    calories = body.get("calories", 0)
    diet_plan = body.get("diet_plan", {})
    workout_plan = body.get("workout_plan", {})
    ai_advice = body.get("ai_advice", "")
    chat_history = body.get("chat_history", [])

    # ----------------------------
    # 1) Existing history load karo
    # ----------------------------
    history = load_history()
    if username not in history:
        history[username] = {
            "calories": [],
            "diet": [],
            "workout": [],
            "chat": []
        }

    # ----------------------------
    # 2) Save new summary
    # ----------------------------
    history[username]["calories"].append(calories)
    history[username]["diet"].append(diet_plan)
    history[username]["workout"].append(workout_plan)
    history[username]["chat"].append(chat_history)

    # Write to file
    save_history(history)

    # ----------------------------
    # 3) Generate PDF (same)
    # ----------------------------
    pdf_path = create_summary_pdf(
        username=username,
        calories=calories,
        diet_plan=diet_plan,
        workout_plan=workout_plan,
        ai_advice=ai_advice,
        chat_history=chat_history,
    )

    filename = os.path.basename(pdf_path)

     # ⭐ NEW: Auto-detect base URL (works on Render + Local)
    base_url = str(Request.base_url).rstrip("/")

    return {
        "success": True,
        "pdf_url": f"{base_url}/static/{filename}",   # ⭐ FIXED LINE
        "history": history[username]
    }
