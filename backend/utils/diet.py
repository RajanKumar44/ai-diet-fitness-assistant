def calculate_bmr(age, weight, height, gender):
    if gender == "Male":
        return 10 * weight + 6.25 * height - 5 * age + 5
    else:
        return 10 * weight + 6.25 * height - 5 * age - 161

def calculate_daily_calories(age, weight, height, gender, goal, activity):
    bmr = calculate_bmr(age, weight, height, gender)

    if activity == "Low":
        factor = 1.3
    elif activity == "Moderate":
        factor = 1.5
    else:
        factor = 1.7

    maintenance = bmr * factor

    if goal == "Weight Loss":
        return maintenance - 300
    elif goal == "Muscle Gain":
        return maintenance + 300
    else:
        return maintenance

def generate_diet_plan(age, weight, height, gender, goal, food_type, activity):
    target_cal = int(calculate_daily_calories(age, weight, height, gender, goal, activity))
    plan = f"Target Calories: ~{target_cal} kcal/day ({goal})\nDiet Type: {food_type}\n\nSuggested Meal Plan:\n"

    if food_type == "Vegetarian":
        plan += """
Breakfast:
- Oats with milk and fruits
- Dry fruits

Lunch:
- 2 chapatis, vegetabless
- Dal, salad

Dinner:
- 2 chapatis or rice
- Dal + veggies
"""
    else:
        plan += """
Breakfast:
- 2 eggs + bread
- Milk

Lunch:
- Chicken curry / fish
- Rice or chapati

Dinner:
- Grilled chicken / paneer
- Veggies
"""

    return target_cal, plan
