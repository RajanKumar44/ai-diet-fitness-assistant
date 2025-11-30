import streamlit as st
import pandas as pd
import json
from utils.database import init_db, create_user, get_users, save_history, get_history
from utils.ai_engine import get_diet_plan, get_workout_plan, get_calorie_estimate
from utils.exporter import create_summary_pdf
from utils.ai_recommender import get_ai_recommendation
from streamlit_mic_recorder import speech_to_text
from utils.ai_chat import chat_with_coach
from utils.fitness_generator import generate_workout_plan, generate_diet_plan




# ------------------------------
# PAGE CONFIG + CUSTOM CSS
# ------------------------------
st.set_page_config(page_title="AI Diet & Fitness Assistant", layout="wide", page_icon="💪")

# Fancy UI styling
st.markdown("""
<style>
.stApp {
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    color: white;
}

.card {
    background: rgba(255, 255, 255, 0.12);
    padding: 20px;
    border-radius: 15px;
    backdrop-filter: blur(6px);
    box-shadow: 0px 0px 15px #00eaff80;
    margin-bottom: 20px;
}

.glitter {
    font-size: 40px !important;
    font-weight: 800 !important;
    background: linear-gradient(90deg, #00ffff, #ff00ff, #00ff99);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
</style>
""", unsafe_allow_html=True)


# ------------------------------
# BMI Calculator
# ------------------------------
def calculate_bmi(weight, height_cm):
    if height_cm == 0:
        return None, "Invalid height"

    height_m = height_cm / 100
    bmi = weight / (height_m ** 2)

    if bmi < 18.5:
        status = "Underweight"
    elif bmi < 25:
        status = "Normal"
    elif bmi < 30:
        status = "Overweight"
    else:
        status = "Obese"

    return bmi, status


# ------------------------------
# Initialize database
# ------------------------------
init_db()

# ------------------------------
# Title
# ------------------------------
st.markdown("<h1 class='glitter'>✨ AI Diet & Fitness Assistant ✨</h1>", unsafe_allow_html=True)
st.write("Your intelligent fitness companion for diet, workout, and calorie insights.")

st.write("---")

# ------------------------------
# SIDEBAR USER SYSTEM
# ------------------------------
st.sidebar.header("👤 User Profile")

users = get_users()
user_names = ["New User"] + [f"{u[0]} - {u[1]}" for u in users]
user_choice = st.sidebar.selectbox("Select User", user_names)

if user_choice == "New User":

    st.sidebar.subheader("Create New User")

    name = st.sidebar.text_input("Name")
    age = st.sidebar.number_input("Age", 10, 80, 20)
    weight = st.sidebar.number_input("Weight (kg)", 30.0, 200.0, 60.0)
    height = st.sidebar.number_input("Height (cm)", 120.0, 220.0, 170.0)
    gender = st.sidebar.selectbox("Gender", ["Male", "Female"])
    goal = st.sidebar.selectbox("Goal", ["Weight Loss", "Muscle Gain", "Maintain Weight"])
    activity = st.sidebar.selectbox("Activity Level", ["Low", "Moderate", "High"])

    # FIXED Save User block (no rerun)
    if st.sidebar.button("Save User"):
        if name.strip() == "":
            st.sidebar.error("Enter a valid name.")
        else:
            create_user(name, age, weight, height, gender, goal)
            st.session_state["user_saved"] = True

    if st.session_state.get("user_saved", False):
        st.sidebar.success("User saved! Now select from dropdown.")

    active_user = None
    user_data = (name, age, weight, height, gender, goal, activity)

else:
    selected_id = int(user_choice.split(" - ")[0])
    active_user = selected_id

    user_row = [u for u in users if u[0] == selected_id][0]
    _, name, age, weight, height, gender, goal = user_row

    activity = st.sidebar.selectbox("Activity Level", ["Low", "Moderate", "High"])

    user_data = (name, age, weight, height, gender, goal, activity)

    st.sidebar.markdown(f"### {name}")
    st.sidebar.write(f"**Goal:** {goal}")

# ------------------------------
# Initialize chat history
# ------------------------------
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = [
        {
            "role": "system",
            "content": "You are a friendly fitness and nutrition coach. Give clear, simple, practical advice."
        }
    ]


# Show BMI
name, age, weight, height, gender, goal, activity = user_data
bmi, bmi_status = calculate_bmi(weight, height)
st.markdown(f"### 🩺 BMI: `{bmi:.1f}` ({bmi_status})")

st.write("---")

# ------------------------------
# MAIN SECTIONS
# ------------------------------
col1, col2 = st.columns(2)

# ------------------------------
# DIET PLAN
# ------------------------------
with col1:
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    st.subheader("🥗 Diet Plan Generator")

    diet_type = st.selectbox("Diet Type", ["Vegetarian", "Non-Vegetarian"])

    if st.button("Generate Diet Plan"):
        calories, diet_plan = get_diet_plan(age, weight, height, gender, goal, diet_type, activity)
        st.session_state["diet_plan"] = diet_plan
        st.session_state["diet_calories"] = calories

    if "diet_plan" in st.session_state:
        st.markdown(f"**Daily Target Calories:** `{st.session_state['diet_calories']}` kcal")
        st.text_area("Diet Plan", st.session_state["diet_plan"], height=270)

    st.markdown("</div>", unsafe_allow_html=True)

# ------------------------------
# WORKOUT PLAN
# ------------------------------
with col2:
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    st.subheader("💪 Workout Plan Generator")

    experience = st.selectbox("Experience Level", ["Beginner", "Intermediate", "Advanced"])
    equipment = st.selectbox("Equipment", ["No Equipment", "Basic Home", "Gym Available"])

    if st.button("Generate Workout Plan"):
        plan = get_workout_plan(goal, experience, equipment)
        st.session_state["workout_plan"] = plan

    if "workout_plan" in st.session_state:
        st.text_area("Workout Plan", st.session_state["workout_plan"], height=270)

    st.markdown("</div>", unsafe_allow_html=True)

st.write("---")

# ------------------------------
# ADVANCED WORKOUT + DIET GENERATOR (TEAM MODULE)
# ------------------------------
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.subheader("⚡ Advanced Workout + Diet Generator (Team Module)")

st.write("Fill the fields below to generate a combined fitness plan:")

age_adv = st.number_input("Age", min_value=10, max_value=100, step=1)
gender_adv = st.selectbox("Gender", ["male", "female"], key="gen_adv")
height_adv = st.number_input("Height (cm)", min_value=100, max_value=250, step=1)
weight_adv = st.number_input("Weight (kg)", min_value=20, max_value=200, step=1)

goal_adv = st.selectbox("Goal", ["weight loss", "muscle gain", "maintenance"], key="goal_adv")
location_adv = st.selectbox("Workout Location", ["home", "gym"], key="loc_adv")
days_adv = st.slider("Workout Days per Week", 1, 6, key="days_adv")
experience_adv = st.selectbox("Experience Level", ["beginner", "intermediate", "advanced"], key="exp_adv")
activity_adv = st.selectbox("Activity Level", ["sedentary", "lightly active", "moderately active", "very active"], key="act_adv")
food_pref_adv = st.selectbox("Food Preference", ["veg", "non-vegetarian", "vegan"], key="food_adv")

# Build user dict
user_adv = {
    "age": age_adv,
    "gender": gender_adv,
    "height_cm": height_adv,
    "weight_kg": weight_adv,
    "goal": goal_adv,
    "location": location_adv,
    "days_per_week": days_adv,
    "experience": experience_adv,
    "activity_level": activity_adv,
    "food_preference": food_pref_adv
}

if st.button("Generate Advanced Fitness Plan"):
    st.success("Plan Generated Successfully!")

    workout = generate_workout_plan(user_adv)
    diet = generate_diet_plan(user_adv)

    # 🔹 Save raw dicts (optional, if you need them later)
    st.session_state["adv_workout_raw"] = workout
    st.session_state["adv_diet_raw"] = diet

    # 🔹 Convert to pretty text for history + PDF
    workout_text = json.dumps(workout, indent=2)
    diet_text = json.dumps(diet, indent=2)

    # 🔹 These keys are already used by:
    #     - Save Today's Summary
    #     - PDF export
    #     - History display
    st.session_state["workout_plan"] = workout_text
    st.session_state["diet_plan"] = diet_text

    # 🔹 Show on screen as JSON (same as before)
    st.subheader("🏋️ Workout Plan")
    st.json(workout)

    st.subheader("🍽️ Diet Plan")
    st.json(diet)


st.markdown("</div>", unsafe_allow_html=True)

# ------------------------------
# CALORIE ESTIMATOR (with Voice)
# ------------------------------
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.subheader("🔥 Calorie Estimator")

col_voice, col_text = st.columns([1, 2])

with col_voice:
    st.write("🎤 Or speak your meal:")
    voice_text = speech_to_text(
        language="en",
        start_prompt="🎙️ Start talking",
        stop_prompt="⏹ Stop",
        just_once=True,
        use_container_width=True,
        key="food_voice"
    )
    if voice_text:
        st.success(f"Recognized: {voice_text}")

with col_text:
    food_text = st.text_input("Or type your food (e.g., '2 chapati, dal, salad')")

if st.button("Estimate Calories"):
    # Prefer voice if available, else text
    query = voice_text if voice_text else food_text

    if not query:
        st.warning("Please speak or type your food first.")
    else:
        total_cal, details = get_calorie_estimate(query)
        st.session_state["calorie_estimate"] = total_cal
        st.write(f"### Total Calories: `{total_cal}` kcal")
        st.text(details)

st.markdown("</div>", unsafe_allow_html=True)

# ------------------------------
# HELPER: FORMAT CHAT HISTORY FOR PDF
# ------------------------------
def format_chat_history(chat_list):
    formatted = ""
    for msg in chat_list:
        if msg["role"] == "user":
            formatted += f"User: {msg['content']}\n"
        elif msg["role"] == "assistant":
            formatted += f"Coach: {msg['content']}\n"
    return formatted


# ------------------------------
# PDF DOWNLOAD + HISTORY
# ------------------------------
st.write("---")
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.subheader("📜 User History & Summary")

if active_user is not None:

    # PDF EXPORT BUTTON — Only show if both plans exist
    if "diet_plan" in st.session_state and "workout_plan" in st.session_state:

        st.markdown("### 📄 Download Your Full PDF Summary")

        if st.button("Download PDF", key="pdf_button"):

            # --- GET ALL DATA SAFELY ---
            diet_plan = st.session_state["diet_plan"]
            workout_plan = st.session_state["workout_plan"]
            cal = float(st.session_state.get("calorie_estimate", 0.0))  # <--- FIXED
            ai_adv = st.session_state.get("ai_advice", "")


            # Convert chat history to printable text
            chat_hist = "\n".join(
                f"{msg['role'].upper()}: {msg['content']}"
                for msg in st.session_state["chat_history"]
                if msg["role"] != "system"
            )

            # --- CREATE PDF ---
            pdf_path = create_summary_pdf(
                username=name,
                calories=cal,
                diet_plan=diet_plan,
                workout_plan=workout_plan,
                ai_advice=ai_adv,
                chat_history=chat_hist
            )

            # --- DOWNLOAD BUTTON ---
            with open(pdf_path, "rb") as pdf:
                st.download_button(
                    label="📥 Click here to download PDF",
                    data=pdf,
                    file_name="summary.pdf",
                    mime="application/pdf",
                )

    # SAVE TODAY'S SUMMARY
    if st.button("Save Today's Summary"):
        diet_plan = st.session_state.get("diet_plan", "")
        workout_plan = st.session_state.get("workout_plan", "")
        cal = float(st.session_state.get("calorie_estimate", 0.0))
        save_history(active_user, cal, diet_plan, workout_plan)
        st.success("Saved successfully!")

    # SHOW HISTORY
    if st.checkbox("Show History"):
        hist = get_history(active_user)

        if not hist:
            st.info("No history found.")
        else:
            dates = []
            cal_list = []
            for row in hist:
                date, cal, _, _ = row
                dates.append(date)
                cal_list.append(cal)

            df = pd.DataFrame({"date": dates, "calories": cal_list})
            df["date"] = pd.to_datetime(df["date"])
            df = df.sort_values("date")

            st.subheader("📈 Weekly Calorie Trend")
            st.line_chart(df.set_index("date")["calories"])

            st.write("---")

            for row in hist:
                date, cal, diet, workout = row
                st.markdown(f"### 📅 {date}")
                st.write(f"**Calories:** `{cal}` kcal")
                with st.expander("Diet Plan"):
                    st.text(diet)
                with st.expander("Workout Plan"):
                    st.text(workout)
                st.write("---")

st.markdown("</div>", unsafe_allow_html=True)
# ------------------------------
# AI CHAT COACH
# ------------------------------
st.write("---")
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.subheader("💬 Chat with AI Fitness Coach")

chat_container = st.container()

# Show previous messages
with chat_container:
    for msg in st.session_state["chat_history"]:
        if msg["role"] == "system":
            continue
        if msg["role"] == "user":
            st.markdown(f"**🧑 You:** {msg['content']}")
        elif msg["role"] == "assistant":
            st.markdown(f"**🤖 Coach:** {msg['content']}")

# Input box
user_msg = st.text_input("Ask anything about diet, workout, or health:", key="chat_input")

if st.button("Send Question"):
    if user_msg.strip():
        # Add user message
        st.session_state["chat_history"].append({"role": "user", "content": user_msg})

        with st.spinner("Coach is thinking..."):
            reply = chat_with_coach(st.session_state["chat_history"])

        # Add assistant reply
        st.session_state["chat_history"].append({"role": "assistant", "content": reply})

        # Force UI refresh
        st.rerun()


st.markdown("</div>", unsafe_allow_html=True)


# ------------------------------
# AI RECOMMENDER
# ------------------------------
st.write("---")
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.subheader("🤖 AI Coach Recommendation")

if st.button("Get AI Recommendation"):
    last_cal = float(st.session_state.get("calorie_estimate", 0.0))

    with st.spinner("Analyzing health data..."):
        advice = get_ai_recommendation(name, age, weight, height, gender, goal, activity, last_cal)
    st.session_state["ai_advice"] = advice

    st.markdown("### Your Personalized AI Advice:")
    st.write(advice)

st.markdown("</div>", unsafe_allow_html=True)
