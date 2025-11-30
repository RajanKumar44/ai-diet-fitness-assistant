import sqlite3
from datetime import datetime

DB_NAME = "fitness_app.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            age INTEGER,
            weight REAL,
            height REAL,
            gender TEXT,
            goal TEXT
        );
    """)

    # history table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            calories REAL,
            diet_plan TEXT,
            workout_plan TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    """)

    conn.commit()
    conn.close()

def create_user(name, age, weight, height, gender, goal):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (name, age, weight, height, gender, goal) VALUES (?, ?, ?, ?, ?, ?)",
        (name, age, weight, height, gender, goal)
    )
    conn.commit()
    conn.close()

def get_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, age, weight, height, gender, goal FROM users")
    rows = cur.fetchall()
    conn.close()
    return rows

def save_history(user_id, calories, diet_plan, workout_plan):
    conn = get_connection()
    cur = conn.cursor()
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "INSERT INTO history (user_id, date, calories, diet_plan, workout_plan) VALUES (?, ?, ?, ?, ?)",
        (user_id, date_str, calories, diet_plan, workout_plan)
    )
    conn.commit()
    conn.close()

def get_history(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT date, calories, diet_plan, workout_plan FROM history WHERE user_id = ? ORDER BY date DESC", (user_id,))
    rows = cur.fetchall()
    conn.close()
    return rows
