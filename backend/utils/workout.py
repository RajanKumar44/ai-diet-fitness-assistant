def generate_workout_plan(goal, experience, equipment):
    plan = f"Goal: {goal}\nExperience: {experience}\nEquipment: {equipment}\n\nWorkout Plan:\n"

    if goal == "Weight Loss":
        plan += """
Day 1: Cardio + Bodyweight
- Jumping jacks
- Squats
- Push-ups

Day 2: Light Cardio
- Walking / jogging

Day 3: Repeat
"""
    else:
        plan += """
Day 1: Chest & Back
- Push-ups
- Rows

Day 2: Legs & Shoulders
- Squats
- Shoulder press
"""
    return plan
