def generate_workout_plan(user):
    # ---------- 1) Read values safely with defaults ----------
    # Frontend currently sends only: experience, equipment
    # We give default values for missing ones

    age = user.get("age", 22)
    gender = (user.get("gender") or "male").lower()
    height = user.get("height_cm", 170)
    weight = user.get("weight_kg", 60)

    # goal may be missing – default to "maintenance"
    goal = (user.get("goal") or "maintenance").lower()

    # location may not be sent – infer from equipment
    equipment = user.get("equipment", "No Equipment")
    location = user.get("location")
    if not location:
        # If gym equipment, assume gym, otherwise home
        if equipment == "Gym Available":
            location = "gym"
        else:
            location = "home"
    location = location.lower()

    # days_per_week may be missing – default to 4
    days = user.get("days_per_week") or 4

    # experience may be missing – default beginner
    level = (user.get("experience") or "beginner").lower()

    # ---------- 2) Exercise bank ----------
    exercises = {
        "home": {
            "Full Body": ["Pushups", "Squats", "Glute Bridge", "Burpees", "Plank"],
            "Upper": ["Pushups", "Pike Pushups", "Tricep Dips", "Plank Shoulder Taps"],
            "Lower": ["Squats", "Lunges", "Glute Bridge", "Calf Raises"],
            "Push": ["Pushups", "Incline Pushups", "Tricep Dips"],
            "Pull": ["Towel Rows", "Reverse Snow Angels"],
            "Legs": ["Squats", "Lunges", "Glute Bridge", "Wall Sit"],
        },
        "gym": {
            "Full Body": ["Bench Press", "Lat Pulldown", "Squats", "Leg Press", "Cable Rows"],
            "Upper": ["Bench Press", "Shoulder Press", "Lat Pulldown", "Cable Fly", "Tricep Pushdown"],
            "Lower": ["Squats", "Leg Extension", "Hamstring Curl", "Leg Press", "Calf Raises"],
            "Push": ["Bench Press", "Shoulder Press", "Tricep Dip Machine"],
            "Pull": ["Lat Pulldown", "Cable Row", "Face Pulls", "Bicep Curls"],
            "Legs": ["Squats", "Deadlifts", "Leg Press", "Leg Curl"],
        },
    }

    # ---------- 3) Choose split based on days ----------
    def choose_split(days):
        if days <= 3:
            return ["Full Body"] * days
        elif days == 4:
            return ["Upper", "Lower", "Upper", "Lower"]
        elif days == 5:
            return ["Push", "Pull", "Legs", "Upper", "Lower"]
        else:
            return ["Push", "Pull", "Legs", "Push", "Pull", "Legs"]

    split = choose_split(days)

    # ---------- 4) Set reps/sets by goal ----------
    if goal == "weight loss":
        reps, sets, notes = "12–20 reps", "3–4 sets", "Add 15–25 min cardio after workout."
    elif goal == "muscle gain":
        reps, sets, notes = "6–12 reps", "4–5 sets", "Increase weight every 1–2 weeks."
    else:
        reps, sets, notes = "10–15 reps", "3–4 sets", "Focus on consistent training."

    # ---------- 5) Build final plan ----------
    final_plan = {}
    loc_exercises = exercises.get(location, exercises["home"])

    for i, day_type in enumerate(split, start=1):
        selected = loc_exercises.get(day_type, [])
        final_plan[f"Day {i} - {day_type}"] = {
            "Warm-up": "5–10 min dynamic warmup",
            "Exercises": [{"name": ex, "sets": sets, "reps": reps} for ex in selected],
            "Cooldown": "5 min stretching",
        }

    return {
        "Workout Overview": {
            "age": age,
            "gender": gender,
            "height_cm": height,
            "weight_kg": weight,
            "goal": goal,
            "location": location,
            "days_per_week": days,
            "experience": level,
            "equipment": equipment,
        },
        "Workout Plan": final_plan,
        "Workout Notes": notes,
    }



def generate_diet_plan(user):
    # --------- 1) SAFE READ WITH DEFAULTS ---------
    # If frontend sends only { "diet_type": "Vegetarian" }, this still works.

    age = user.get("age", 22)
    gender = (user.get("gender") or "male").lower()
    height = user.get("height_cm") or user.get("height") or 170
    weight = user.get("weight_kg") or user.get("weight") or 60
    goal = (user.get("goal") or "maintenance").lower()
    activity = (user.get("activity_level") or "moderately active").lower()

    # food_preference can come from:
    # - user["food_preference"], OR
    # - diet_type string sent from frontend
    food_pref = (user.get("food_preference") or "").lower()
    diet_type = (user.get("diet_type") or "").lower()

    if not food_pref:
        if "non" in diet_type:
            food_pref = "non-vegetarian"
        elif "vegan" in diet_type:
            food_pref = "vegan"
        else:
            food_pref = "veg"  # default

    # --------- 2) BMR + TDEE ---------
    if gender == "male":
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161

    activity_multiplier = {
        "sedentary": 1.2,
        "lightly active": 1.375,
        "moderately active": 1.55,
        "very active": 1.75,
    }.get(activity, 1.375)

    maintenance_calories = bmr * activity_multiplier

    if goal == "weight loss":
        target_calories = maintenance_calories - 400
    elif goal == "muscle gain":
        target_calories = maintenance_calories + 300
    else:
        target_calories = maintenance_calories

    protein_g = weight * 1.8
    fats_g = (target_calories * 0.25) / 9
    carbs_g = (target_calories - (protein_g * 4 + fats_g * 9)) / 4

    # --------- 3) MEAL BANK ---------
    meals = {
        "veg": {
            "breakfast": ["Oats + Milk + Banana"],
            "lunch": ["Rice + Dal + Veg Curry + Curd"],
            "dinner": ["Khichdi + Salad"],
            "snacks": ["Fruits", "Nuts", "Protein Shake"],
        },
        "non-vegetarian": {
            "breakfast": ["Egg Omelette + Bread"],
            "lunch": ["Rice + Chicken Curry + Veg"],
            "dinner": ["Grilled Chicken + Rice"],
            "snacks": ["Boiled Eggs", "Protein Shake"],
        },
        "vegan": {
            "breakfast": ["Oats + Almond Milk"],
            "lunch": ["Rice + Dal + Veg Curry"],
            "dinner": ["Quinoa + Veg Stir Fry"],
            "snacks": ["Fruits", "Soy Milk Shake", "Nuts"],
        },
    }

    plan_meals = meals.get(food_pref, meals["veg"])

    return {
        "Calories": round(target_calories),
        "Maintenance Calories": round(maintenance_calories),
        "Macros": {
            "Protein (g)": round(protein_g),
            "Carbs (g)": round(carbs_g),
            "Fats (g)": round(fats_g),
        },
        "Diet Plan": {
            "Breakfast": plan_meals["breakfast"][0],
            "Lunch": plan_meals["lunch"][0],
            "Dinner": plan_meals["dinner"][0],
            "Snacks": plan_meals["snacks"],
        },
    }



def generate_advanced_fitness_plan(user):
    """
    Combines workout + diet plan into one final structured response.
    """

    workout = generate_workout_plan(user)
    diet = generate_diet_plan(user)

    return {
        "success": True,
        "user_input": user,
        "advanced_plan": {
            "Workout Plan": workout["Workout Plan"],
            "Workout Notes": workout["Workout Notes"],
            "Diet Plan": diet["Diet Plan"],
            "Target Calories": diet["Calories"],
            "Macros": diet["Macros"]
        }
    }
