import os
import textwrap
import json
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib import colors

# ---------------------------------------------------
# FONT REGISTRATION (Unicode)
# ---------------------------------------------------
FONT_PATH = "utils/fonts/NotoSans-Regular.ttf"
try:
    pdfmetrics.registerFont(TTFont("Noto", FONT_PATH))
    DEFAULT_FONT = "Noto"
except Exception:
    # Fallback in case font missing
    DEFAULT_FONT = "Helvetica"


# ---------------------------------------------------
# PREMIUM STRUCTURED PDF GENERATOR
# ---------------------------------------------------
def create_summary_pdf(username, calories, diet_plan, workout_plan, ai_advice, chat_history):

    # Create folder
    os.makedirs("exports", exist_ok=True)
    filename = f"{username}_Fitness_Report.pdf".replace(" ", "_")
    filepath = os.path.join("exports", filename)

    c = canvas.Canvas(filepath, pagesize=A4)
    width, height = A4
    y = height - 50

    # ---------------------------------------------------
    # Helper Functions
    # ---------------------------------------------------
    def header(title):
        nonlocal y
        c.setFont(DEFAULT_FONT, 18)
        c.setFillColor(colors.HexColor("#00E5FF"))
        c.drawString(40, y, title)
        y -= 12

        c.setLineWidth(2)
        c.setStrokeColor(colors.HexColor("#00A8E8"))
        c.line(40, y, width - 40, y)
        y -= 25

        c.setFillColor(colors.black)

    def write_paragraph(text, wrap=75, font_size=11):
        nonlocal y
        if not text:
            return
        c.setFont(DEFAULT_FONT, font_size)
        lines = textwrap.wrap(str(text), wrap)
        for line in lines:
            c.drawString(40, y, line)
            y -= 15
            if y < 80:
                c.showPage()
                reset_page()
        y -= 10

    def reset_page():
        nonlocal y
        y = height - 50
        c.setFont(DEFAULT_FONT, 11)

    def draw_table(title, table_data, col_widths):
        nonlocal y
        if not table_data:
            return

        if title:
            header(title)

        c.setFont(DEFAULT_FONT, 11)
        row_height = 18

        for row in table_data:
            x_pos = 40
            for i, cell in enumerate(row):
                c.drawString(x_pos, y, str(cell))
                x_pos += col_widths[i]
            y -= row_height

            if y < 80:
                c.showPage()
                reset_page()
        y -= 20

    # ------------- AI Recommendation Markdown Renderer -------------
    def render_markdown(md_text):
        nonlocal y
        if not md_text:
            return

        c.setFont(DEFAULT_FONT, 12)
        lines = str(md_text).split("\n")
        indent = 40

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # ---- Header (Markdown ### or bold without colon) ----
            if line.startswith("###") or (line.startswith("**") and line.endswith("**") and ":" not in line):
                title = line.replace("#", "").replace("**", "").strip()
                c.setFont(DEFAULT_FONT, 14)
                c.drawString(40, y, title)
                y -= 20
                c.setFont(DEFAULT_FONT, 12)
                continue

            # ---- Bullet Points ----
            if line.startswith("- ") or line.startswith("* "):
                bullet = "• "
                text = line[2:]
                c.drawString(indent, y, bullet + text)
                y -= 15
                continue

            # ---- Sub-bullets ----
            if line.startswith("+ "):
                bullet = "  ◦ "
                text = line[2:]
                c.drawString(indent + 20, y, bullet + text)
                y -= 15
                continue

            # ---- Normal paragraph ----
            wrapped = textwrap.wrap(line, 70)
            for w in wrapped:
                c.drawString(40, y, w)
                y -= 15
                if y < 80:
                    c.showPage()
                    reset_page()
            y -= 5

    # ---------------------------------------------------
    # START DOCUMENT
    # ---------------------------------------------------
    header("AI Diet & Fitness Assistant — Premium Report")
    write_paragraph(f"User: {username}")
    write_paragraph(f"Today's Calories: {calories} kcal")

    # ---------------------------------------------------
    # WORKOUT TABLE
    # ---------------------------------------------------
    header("💪 Workout Plan")

    # workout_plan can be dict or JSON string
    workout_obj = workout_plan
    if isinstance(workout_plan, str):
        try:
            workout_obj = json.loads(workout_plan)
        except Exception:
            workout_obj = workout_plan  # keep raw

    if isinstance(workout_obj, dict) and "Workout Plan" in workout_obj:
        plan_dict = workout_obj.get("Workout Plan", {})

        for day, data in plan_dict.items():
            write_paragraph(f"► {day}", font_size=13)

            exercises = []
            if isinstance(data, dict):
                exercises = data.get("Exercises", [])
            elif isinstance(data, list):
                exercises = data

            table = [["Exercise", "Sets", "Reps"]]

            for ex in exercises:
                if isinstance(ex, dict):
                    table.append([
                        ex.get("name", ""),
                        ex.get("sets", ""),
                        ex.get("reps", ""),
                    ])
                else:
                    # fallback if string
                    table.append([str(ex), "", ""])

            draw_table("", table, [250, 100, 100])

        notes = workout_obj.get("Workout Notes") or workout_obj.get("notes") or ""
        if notes:
            write_paragraph(f"Notes: {notes}", wrap=90)
    else:
        # Fallback: just dump text
        write_paragraph(str(workout_plan), wrap=90)

    # ---------------------------------------------------
    # DIET PLAN TABLE
    # ---------------------------------------------------
    header("🍽 Diet Plan")

    diet_obj = diet_plan
    if isinstance(diet_plan, str):
        try:
            diet_obj = json.loads(diet_plan)
        except Exception:
            diet_obj = diet_plan

    if isinstance(diet_obj, dict):
        macros = diet_obj.get("Macros") or diet_obj.get("macros")

        if isinstance(macros, dict):
            macro_table = [
                ["Protein (g)", macros.get("Protein (g)") or macros.get("protein") or ""],
                ["Carbs (g)", macros.get("Carbs (g)") or macros.get("carbs") or ""],
                ["Fats (g)", macros.get("Fats (g)") or macros.get("fats") or ""],
            ]
            draw_table("Daily Macros", macro_table, [200, 200])

        dp = diet_obj.get("Diet Plan") or diet_obj.get("diet_plan")
        if isinstance(dp, dict):
            diet_table = [["Meal", "Food"]]
            if "Breakfast" in dp:
                diet_table.append(["Breakfast", dp["Breakfast"]])
            if "Lunch" in dp:
                diet_table.append(["Lunch", dp["Lunch"]])
            if "Dinner" in dp:
                diet_table.append(["Dinner", dp["Dinner"]])
            if "Snacks" in dp:
                snacks_val = dp["Snacks"]
                if isinstance(snacks_val, list):
                    snacks_text = ", ".join(snacks_val)
                else:
                    snacks_text = str(snacks_val)
                diet_table.append(["Snacks", snacks_text])

            draw_table("Meals", diet_table, [150, 300])
        else:
            # No structured diet plan, dump string
            write_paragraph(str(diet_plan), wrap=90)
    else:
        write_paragraph(str(diet_plan), wrap=90)

    # ---------------------------------------------------
    # AI RECOMMENDATION (Premium Formatting)
    # ---------------------------------------------------
    header("🤖 AI Recommendation")
    render_markdown(ai_advice)

    # ---------------------------------------------------
    # CHAT HISTORY (Premium Formatting)
    # ---------------------------------------------------
    header("💬 Chat History")

    # chat_history can be list of dicts, list of strings, or string
    chat_lines = []

    if isinstance(chat_history, str):
        chat_lines = chat_history.split("\n")
    elif isinstance(chat_history, list):
        # Try to convert to text format
        for msg in chat_history:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                role = msg["role"]
                content = msg["content"]
                if role == "user":
                    chat_lines.append(f"you: {content}")
                elif role == "assistant":
                    chat_lines.append(f"coach: {content}")
                else:
                    chat_lines.append(str(content))
            else:
                chat_lines.append(str(msg))
    else:
        chat_lines = [str(chat_history)]

    c.setFont(DEFAULT_FONT, 12)

    for line in chat_lines:
        line = line.strip()
        if not line:
            continue

        lower = line.lower()

        # User messages
        if lower.startswith("you:"):
            c.setFont(DEFAULT_FONT, 13)
            c.drawString(40, y, "🧑 You:")
            y -= 18
            c.setFont(DEFAULT_FONT, 11)
            user_msg = line[4:].strip()
            for part in textwrap.wrap(user_msg, 70):
                c.drawString(60, y, part)
                y -= 14
                if y < 80:
                    c.showPage()
                    reset_page()
            y -= 5
            continue

        # Coach messages
        if lower.startswith("coach:"):
            c.setFont(DEFAULT_FONT, 13)
            c.drawString(40, y, "🤖 Coach:")
            y -= 18
            c.setFont(DEFAULT_FONT, 11)
            coach_msg = line[6:].strip()
            for part in textwrap.wrap(coach_msg, 70):
                c.drawString(60, y, part)
                y -= 14
                if y < 80:
                    c.showPage()
                    reset_page()
            y -= 5
            continue

        # Markdown headings inside chat
        if line.startswith("**") and line.endswith("**"):
            c.setFont(DEFAULT_FONT, 13)
            c.drawString(40, y, line.replace("**", ""))
            y -= 18
            continue

        # Bullets and sub-bullets
        if line.startswith("* "):
            c.setFont(DEFAULT_FONT, 11)
            c.drawString(60, y, "• " + line[2:])
            y -= 14
            continue

        if line.startswith("+ "):
            c.setFont(DEFAULT_FONT, 11)
            c.drawString(80, y, "◦ " + line[2:])
            y -= 14
            continue

        # Regular wrapped content
        c.setFont(DEFAULT_FONT, 11)
        for part in textwrap.wrap(line, 70):
            c.drawString(40, y, part)
            y -= 14
            if y < 80:
                c.showPage()
                reset_page()

    # ---------------------------------------------------
    # END PDF
    # ---------------------------------------------------
    c.save()
    return filepath
