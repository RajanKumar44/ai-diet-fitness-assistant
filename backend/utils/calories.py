# ---------------------------
# ADVANCED FOOD DATABASE
# ---------------------------
FOOD_DB = {
    # Indian staples
    "chapati": {"cal": 80, "protein": 3, "carbs": 15, "fat": 2},
    "roti": {"cal": 80, "protein": 3, "carbs": 15, "fat": 2},
    "paratha": {"cal": 180, "protein": 4, "carbs": 22, "fat": 8},
    "dal": {"cal": 150, "protein": 9, "carbs": 18, "fat": 2},
    "rajma": {"cal": 210, "protein": 12, "carbs": 30, "fat": 1},
    "chole": {"cal": 220, "protein": 11, "carbs": 30, "fat": 5},
    "khichdi": {"cal": 160, "protein": 6, "carbs": 26, "fat": 3},
    "poha": {"cal": 180, "protein": 3, "carbs": 30, "fat": 5},
    "upma": {"cal": 200, "protein": 5, "carbs": 32, "fat": 6},
    "idli": {"cal": 60, "protein": 2, "carbs": 12, "fat": 0},
    "dosa": {"cal": 120, "protein": 2, "carbs": 20, "fat": 4},
    "sambar": {"cal": 90, "protein": 3, "carbs": 12, "fat" :2},
    "curd": {"cal": 100, "protein": 4, "carbs": 7, "fat": 4},

    # Rice varieties
    "rice": {"cal": 200, "protein": 4, "carbs": 45, "fat": 0},
    "fried rice": {"cal": 300, "protein": 6, "carbs": 50, "fat": 8},
    "biriyani": {"cal": 400, "protein": 12, "carbs": 50, "fat": 15},

    # Proteins
    "egg": {"cal": 70, "protein": 6, "carbs": 1, "fat": 5},
    "egg omelette": {"cal": 150, "protein": 10, "carbs": 2, "fat": 12},
    "chicken": {"cal": 165, "protein": 31, "carbs": 0, "fat": 4},
    "grilled chicken": {"cal": 200, "protein": 35, "carbs": 2, "fat": 5},
    "fish": {"cal": 140, "protein": 26, "carbs": 0, "fat": 3},
    "paneer": {"cal": 265, "protein": 18, "carbs": 6, "fat": 20},
    "tofu": {"cal": 120, "protein": 10, "carbs": 3, "fat": 7},

    # Fruits
    "apple": {"cal": 80, "protein": 0, "carbs": 22, "fat": 0},
    "banana": {"cal": 100, "protein": 1, "carbs": 27, "fat": 0},
    "orange": {"cal": 60, "protein": 1, "carbs": 15, "fat": 0},
    "mango": {"cal": 150, "protein": 1, "carbs": 35, "fat": 1},

    # Snacks
    "nuts": {"cal": 180, "protein": 6, "carbs": 6, "fat": 15},
    "chips": {"cal": 160, "protein": 2, "carbs": 16, "fat": 10},
    "biscuits": {"cal": 80, "protein": 1, "carbs": 12, "fat": 3},

    # Beverages
    "milk": {"cal": 120, "protein": 8, "carbs": 11, "fat": 5},
    "coffee": {"cal": 40, "protein": 1, "carbs": 5, "fat": 1},
    "tea": {"cal": 30, "protein": 0, "carbs": 5, "fat": 1},
}

import re


# -------------------------------------
# ADVANCED CALORIE ESTIMATOR
# -------------------------------------
def estimate_calories(food_text):
    text = food_text.lower()
    total_cal = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    details = ""

    for item, data in FOOD_DB.items():
        pattern = rf"(\d+)?\s*{item}"
        match = re.search(pattern, text)

        if match:
            qty = int(match.group(1)) if match.group(1) else 1

            cal = data["cal"] * qty
            prot = data["protein"] * qty
            carbs = data["carbs"] * qty
            fat = data["fat"] * qty

            total_cal += cal
            total_protein += prot
            total_carbs += carbs
            total_fat += fat

            details += (
                f"{qty} x {item} → {cal} kcal "
                f"(Protein:{prot}g Carbs:{carbs}g Fat:{fat}g)\n"
            )

    summary = f"""
Total Calories: {total_cal} kcal
Protein: {total_protein} g
Carbs: {total_carbs} g
Fat: {total_fat} g
"""

    return total_cal, details + "\n" + summary

