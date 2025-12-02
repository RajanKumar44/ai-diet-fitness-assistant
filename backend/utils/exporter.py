import os
import textwrap
import json
import ast
import re
import time
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib import colors

# ---------------------------------------------------
# 1. FONTS & COLORS
# ---------------------------------------------------
FONT_PATH = "utils/fonts/NotoSans-Regular.ttf"
try:
    pdfmetrics.registerFont(TTFont("Noto", FONT_PATH))
    DEFAULT_FONT = "Noto"
    BOLD_FONT = "Noto" 
except Exception:
    DEFAULT_FONT = "Helvetica"
    BOLD_FONT = "Helvetica-Bold"

# Professional Theme
COL_PRIMARY = colors.HexColor("#1565C0")   # Deep Blue
COL_ACCENT = colors.HexColor("#42A5F5")    # Light Blue
COL_TABLE_HEAD = colors.HexColor("#1976D2")# Table Header Blue
COL_ROW_EVEN = colors.HexColor("#F1F8FF")  # Very Light Blue Stripe
COL_TEXT = colors.HexColor("#212121")      # Dark Grey Text

# ---------------------------------------------------
# 2. SMART DATA PARSER
# ---------------------------------------------------
def smart_parse(data):
    """Recursively parses data to ensure it's a valid Dictionary."""
    if not data: return {}
    if isinstance(data, dict): return data
    
    if isinstance(data, str):
        data = data.strip()
        try: return json.loads(data)
        except: pass
        try: return ast.literal_eval(data)
        except: pass
            
    return {}

def clean_text(text):
    """Cleans list strings like ['Oats', 'Milk'] -> 'Oats, Milk'"""
    if isinstance(text, list):
        return ", ".join([str(x) for x in text])
    return str(text).replace("[", "").replace("]", "").replace("'", "").strip()

def extract_day_number(key):
    nums = re.findall(r'\d+', str(key))
    return int(nums[0]) if nums else 999

# ---------------------------------------------------
# 3. PDF GENERATOR
# ---------------------------------------------------
def create_summary_pdf(username, calories, diet_plan, workout_plan, ai_advice, chat_history):
    os.makedirs("exports", exist_ok=True)
    
    # Unique Filename to prevent Caching
    timestamp = int(time.time())
    safe_name = str(username).replace(" ", "_")
    filename = f"{safe_name}_Fitness_Report_{timestamp}.pdf"
    filepath = os.path.join("exports", filename)

    c = canvas.Canvas(filepath, pagesize=A4)
    width, height = A4
    y = height - 50

    def reset_page():
        nonlocal y
        c.showPage()
        y = height - 50
        draw_header()

    def draw_header():
        # Banner
        c.setFillColor(COL_PRIMARY)
        c.rect(0, height - 85, width, 85, fill=1, stroke=0)
        # Text
        c.setFont(BOLD_FONT, 22)
        c.setFillColor(colors.white)
        c.drawString(40, height - 45, "AI Fitness & Diet Report")
        c.setFont(DEFAULT_FONT, 12)
        c.setFillColor(colors.HexColor("#BBDEFB"))
        c.drawString(40, height - 65, f"User: {username}  |  Target: {calories} kcal")
        c.setFillColor(colors.black)

    # Init Header
    y = height - 100
    draw_header()

    def draw_section_title(title, icon=""):
        nonlocal y
        if y < 100: reset_page()
        y -= 35
        c.setFont(BOLD_FONT, 16)
        c.setFillColor(COL_PRIMARY)
        c.drawString(40, y, f"{icon}  {title}")
        c.setStrokeColor(COL_ACCENT)
        c.setLineWidth(2)
        c.line(40, y - 8, width - 40, y - 8)
        y -= 25

    def draw_table(headers, data, col_widths):
        nonlocal y
        if not data: return

        # Header
        if y < 60: reset_page()
        c.setFillColor(COL_TABLE_HEAD)
        c.rect(40, y - 22, sum(col_widths), 22, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(BOLD_FONT, 10)
        
        curr_x = 45
        for i, h in enumerate(headers):
            c.drawString(curr_x, y - 16, h)
            curr_x += col_widths[i]
        y -= 22

        # Rows
        c.setFont(DEFAULT_FONT, 10)
        c.setFillColor(COL_TEXT)
        
        for idx, row in enumerate(data):
            # Calculate height
            max_lines = 1
            wrapped_row = []
            for i, cell in enumerate(row):
                lines = textwrap.wrap(str(cell), width=int(col_widths[i] / 6))
                wrapped_row.append(lines)
                max_lines = max(max_lines, len(lines))
            
            row_height = (max_lines * 14) + 10

            if y - row_height < 50:
                reset_page()
                y -= 22

            # Background
            if idx % 2 == 0:
                c.setFillColor(COL_ROW_EVEN)
                c.rect(40, y - row_height, sum(col_widths), row_height, fill=1, stroke=0)
                c.setFillColor(COL_TEXT)

            # Draw Text
            curr_x = 45
            for i, lines in enumerate(wrapped_row):
                text_y = y - 14
                for line in lines:
                    c.drawString(curr_x, text_y, line)
                    text_y -= 14
                curr_x += col_widths[i]

            # Border
            c.setStrokeColor(colors.lightgrey)
            c.setLineWidth(0.5)
            c.rect(40, y - row_height, sum(col_widths), row_height, fill=0, stroke=1)

            y -= row_height

    # ==========================
    # 1. WORKOUT SECTION
    # ==========================
    workout_obj = smart_parse(workout_plan)
    draw_section_title("Workout Routine", "💪")

    w_plan = {}
    if "Workout Plan" in workout_obj: w_plan = workout_obj["Workout Plan"]
    elif any("Day" in str(k) for k in workout_obj.keys()): w_plan = workout_obj
    
    if w_plan and isinstance(w_plan, dict):
        days = sorted(w_plan.keys(), key=extract_day_number)
        for day in days:
            if y < 80: reset_page()
            c.setFont(BOLD_FONT, 12)
            c.setFillColor(colors.darkgrey)
            c.drawString(40, y, f"► {day}")
            y -= 20
            
            exercises = w_plan[day]
            if isinstance(exercises, dict): exercises = exercises.get("Exercises", [])
            
            t_data = []
            if isinstance(exercises, list):
                for ex in exercises:
                    if isinstance(ex, dict):
                        t_data.append([ex.get("name", "-"), str(ex.get("sets", "-")), str(ex.get("reps", "-"))])
                    elif isinstance(ex, str):
                        t_data.append([ex, "-", "-"])
            
            if t_data:
                draw_table(["Exercise", "Sets", "Reps"], t_data, [250, 100, 100])
                y -= 10
    else:
        c.setFont(DEFAULT_FONT, 10)
        c.drawString(40, y, "No structured workout plan found.")
        y -= 20

    # ==========================
    # 2. DIET SECTION (FIXED)
    # ==========================
    diet_obj = smart_parse(diet_plan)
    draw_section_title("Nutrition & Diet Plan", "🥗")

    # A. Macros
    macros = diet_obj.get("Macros") or diet_obj.get("macros")
    if macros and isinstance(macros, dict):
        m_data = [[k, f"{v}g"] for k, v in macros.items() if isinstance(v, (int, float, str))]
        if m_data:
            c.setFont(BOLD_FONT, 11)
            c.drawString(40, y, "Daily Nutrition Targets:")
            y -= 20
            draw_table(["Nutrient", "Amount"], m_data, [200, 150])
            y -= 15

    # B. Meals (Universal Fix)
    # Attempt to unwrap "Diet Plan" if it exists, otherwise use root object
    dp = diet_obj.get("Diet Plan") or diet_obj.get("diet_plan") or diet_obj
    
    # Filter out metadata keys
    ignore_keys = ["Calories", "Macros", "Maintenance Calories", "target_calories", "macros"]
    content_keys = [k for k in dp.keys() if isinstance(k, str) and k not in ignore_keys]

    if content_keys:
        # Check if Multi-Day (e.g., "Day 1", "Day 2")
        day_keys = [k for k in content_keys if "day" in k.lower()]
        
        if day_keys:
            # === Multi-Day Table ===
            day_keys.sort(key=extract_day_number)
            for day in day_keys:
                if y < 80: reset_page()
                
                # Day Header
                c.setFont(BOLD_FONT, 12)
                c.setFillColor(colors.darkgrey)
                c.drawString(40, y, f"► {day}")
                y -= 20
                
                # Get Meals for that day
                day_meals = dp[day]
                if isinstance(day_meals, dict):
                    # Sort meals naturally
                    order = ["Breakfast", "Mid-Morning", "Lunch", "Snacks", "Dinner", "Pre-Workout"]
                    t_data = []
                    
                    # Add Ordered Items
                    for m in order:
                        if m in day_meals:
                            t_data.append([m, clean_text(day_meals[m])])
                    
                    # Add Others
                    for k, v in day_meals.items():
                        if k not in order:
                            t_data.append([k, clean_text(v)])

                    draw_table(["Meal", "Recommended Food"], t_data, [130, 360])
                y -= 10
        else:
            # === Single Day Table ===
            order = ["Breakfast", "Mid-Morning", "Lunch", "Snacks", "Dinner", "Pre-Workout"]
            t_data = []
            
            # Add Ordered
            for m in order:
                for k in content_keys:
                    if k.lower() == m.lower():
                        t_data.append([k, clean_text(dp[k])])
            
            # Add Remaining
            printed_keys = [r[0] for r in t_data]
            for k in content_keys:
                if k not in printed_keys:
                     t_data.append([k, clean_text(dp[k])])
            
            if t_data:
                draw_table(["Meal", "Recommended Food"], t_data, [130, 360])
            else:
                c.setFont(DEFAULT_FONT, 10)
                c.drawString(40, y, "No meals listed.")
                y -= 20
    else:
        # If no valid keys found (Fallback)
        c.setFont(DEFAULT_FONT, 10)
        c.drawString(40, y, "No diet details available.")
        y -= 20

    # ==========================
    # 3. AI ADVICE
    # ==========================
    if ai_advice:
        draw_section_title("Coach Advice", "🤖")
        lines = str(ai_advice).split('\n')
        c.setFont(DEFAULT_FONT, 10)
        c.setFillColor(COL_TEXT)
        
        for line in lines:
            line = line.strip()
            if not line: continue
            
            wrapped = textwrap.wrap(line, 90)
            for w in wrapped:
                if y < 40: reset_page()
                c.drawString(40, y, w)
                y -= 14
            y -= 2

    c.save()
    return filepath