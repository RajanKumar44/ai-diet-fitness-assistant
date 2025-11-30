🌟 AI Fitness Assistant – Full-Stack AI-Powered Health & Wellness App

A modern full-stack AI-driven fitness assistant that helps users generate personalized diet plans, workout routines, calorie tracking, AI chat coaching, advanced fitness plans, and complete summary export (PDF).
Built with HTML, CSS, JavaScript, FastAPI, Python, Groq API, and Chart.js, this project provides a sleek dashboard interface along with persistent user data storage.

🚀 Features
🔹 1. AI Diet Plan Generator

Personalized diet plans based on user input

Supports Veg / Non-Veg / Vegan choices

AI-powered content generation

🔹 2. AI Workout Plan Generator

Beginner → Advanced workout levels

Home & Gym equipment modes

🔹 3. Advanced Fitness Plan

Combines workout + diet

Supports height, weight, gender, goal, activity level, days/week

Structured JSON output

🔹 4. Calorie Tracker

AI-powered calorie estimation

Dynamic list of meals

Weekly calorie trend graph

🔹 5. AI Fitness Coach (Chat)

Chat with your AI coach

Conversation stored locally

Real-time responses

🔹 6. AI Recommendation Engine

Automatically generates diet, workout & motivation tips

Clean structured UI

🔹 7. User Profile System

Saves name, age, weight, height, goal, gender, activity level

Auto-loads profile from local storage

🔹 8. Summary Export (PDF)

Saves daily summary

Exports diet, workout, chat, calories, and AI advice into PDF

🔹 9. History & Analytics Dashboard

Displays saved daily summaries

Weekly calorie trend via Chart.js

🔹 10. Fully Persistent Local Storage

All data saved even after page refresh

No backend database required

🖥️ Tech Stack
Frontend

HTML5

CSS3

Tailwind-inspired design

Vanilla JavaScript

Chart.js

Backend

FastAPI

Python 3.10+

Groq API for AI generation

Pydantic

Uvicorn

Data Storage

Browser LocalStorage

Exportable PDF files

📁 Project Structure
ai-fitness-assistant/
├── backend/
│   ├── app.py                   # FastAPI application
│   ├── utils/
│   │   ├── fitness_generator.py # Diet + Workout logic
│   │   └── pdf_exporter.py      # Summary PDF generator
│   └── venv/                    # Virtual environment
│
├── frontend/
│   ├── index.html               # Main UI
│   ├── style.css                # Styling
│   ├── script.js                # Frontend logic
│   └── assets/                  # Images/icons
│
└── README.md                    # Project documentation

⚙️ Getting Started
1. Clone the repository
git clone <your-repo-url>
cd ai-fitness-assistant

🐍 Backend Setup (FastAPI)
2. Create virtual environment
cd backend
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

3. Install dependencies
pip install -r requirements.txt

4. Run the FastAPI server
uvicorn app:app --reload --port 8000


Your backend is now running at:

🔗 http://localhost:8000

📘 API Docs → http://localhost:8000/docs

📘 ReDoc → http://localhost:8000/redoc

🌐 Frontend Setup

No build tools required.
Simply open:

frontend/index.html


in any browser.

For live server:

Right Click → Open with Live Server

📜 API Endpoints
🔥 Diet Plan
POST /diet

🔥 Workout Plan
POST /workout

🔥 Advanced Plan
POST /advanced-plan

🔥 AI Coach Chat
POST /chat

🔥 Calorie Estimation
POST /calories

🔥 Summary Export
POST /export-summary

📊 Dashboard Modules
📌 Dashboard

BMI Status

Daily calorie goal

Quick action shortcuts

📌 Profile

User details saved permanently

📌 Diet & Workout

AI powered plans

Editable and re-generatable

📌 Calorie Tracker

Adds food entries

Weekly chart

Auto-calculated totals

📌 AI Coach

Real-time AI chat

Motivational responses

📌 History

Saves all summaries

PDF download

Weekly analytics

🎨 UI & UX Highlights

Glassmorphism cards

Neon glow gradients

Smooth animations

Sidebar navigation

Advanced structured layout

Mobile responsive design

🧠 AI Powered Modules
Powered by Groq LLM

Natural language responses

Personalized diet & workout generation

Smart calorie estimation

Motivational AI assistance

📦 Deployment
Backend:
uvicorn app:app --host 0.0.0.0 --port 8000

Frontend:

Serve using any static hosting:

Netlify

GitHub Pages

Vercel (static mode)

Nginx

🔒 Security Notes

No passwords saved

All data stays in user's device

Optional JWT login can be added

Minimal backend storage for safety

🛠 Future Improvements
Feature	Status
User login & authentication	🔄 In progress
Cloud database for user history	🔄 Planned
Dark/light theme toggle	🔜
Multi-user support	🔜
Fitness progress graphs	🔜
Voice-based calorie logging	🔜

🤝 Contributing

Fork the repo

Create new feature branch

Write clean code

Submit pull request

❤️ Credits

Developed with passion by Rajan and enhanced with AI-powered intelligence.
Every feature is designed to help you stay fit, consistent, and motivated.

📜 License

MIT License
Free for personal & educational use.