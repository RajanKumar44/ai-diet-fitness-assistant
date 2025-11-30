# ai_engine.py
"""
This file acts as the AI core / engine.
Right now it uses simple rule-based functions from diet.py and workout.py.
Later, we can replace internal logic to call a real LLM (e.g., Gemini).
"""

from utils.diet import generate_diet_plan
from utils.workout import generate_workout_plan
from utils.calories import estimate_calories

# In future, you can add USE_LLM flag here and route to actual AI API.

def get_diet_plan(age, weight, height, gender, goal, food_type, activity):
    # For now, we just call rule-based logic
    calories, plan = generate_diet_plan(age, weight, height, gender, goal, food_type, activity)
    return calories, plan

def get_workout_plan(goal, experience, equipment):
    plan = generate_workout_plan(goal, experience, equipment)
    return plan

def get_calorie_estimate(food_text):
    total, details = estimate_calories(food_text)
    return total, details
