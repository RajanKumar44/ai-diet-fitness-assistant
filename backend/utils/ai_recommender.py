from groq import Groq
from config import GROQ_API_KEY


client = Groq(api_key=GROQ_API_KEY)

def get_ai_recommendation(name, age, weight, height, gender, goal, activity, latest_calories):

    prompt = f"""
You are a friendly fitness and diet expert. 
Write your answer in **Markdown** with clear sections.

User:
- Name: {name}
- Age: {age}
- Weight: {weight} kg
- Height: {height} cm
- Gender: {gender}
- Goal: {goal}
- Activity Level: {activity}
- Latest Estimated Calories: {latest_calories}

Return the answer in EXACTLY this format:

### 🥗 Diet Advice
- (2–3 short bullet points)

### 🏋️ Workout Suggestion
- (2–3 short bullet points)

### 💡 Motivation
- (1–2 short motivational lines)
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.7,
    )

    return response.choices[0].message.content
