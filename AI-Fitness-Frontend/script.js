// =================== GLOBAL VARIABLES =================== //
let latestDietPlan = {};
let latestWorkoutPlan = {};
let lastAIAdvice = "";
let chatHistory = [];
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


// ========== SIMPLE MARKDOWN RENDERER (FOR AI TEXT) ========== //
// This does NOT change any layout. It only converts **bold** and
// "- bullets" into a nicer HTML format.
function renderMarkdown(md) {
  if (!md) return "";
  const lines = md.split("\n");

  const htmlLines = lines.map((line) => {
    let l = line.trimEnd();

    // bold: **text**
    l = l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // bullets: "- text" or "* text"
    if (l.startsWith("- ") || l.startsWith("* ")) {
      return "• " + l.slice(2);
    }

    return l;
  });

  return htmlLines.join("<br>");
}


let USER_PROFILE = {};
let calorieTotal = 0;

// For chart
let weeklyCalories = [0, 0, 0, 0, 0, 0, 0];
let calorieChart = null;

// =================== API BASE URL =================== //
// Change this to your backend URL + port
const API_BASE = "https://ai-diet-fitness-assistant.onrender.com";

function renderDietPlanPretty(plan) {
  if (!plan || typeof plan !== "object") {
    return `<pre>${escapeHtml(JSON.stringify(plan, null, 2))}</pre>`;
  }

  // 1. Flexible Key Access (Case insensitive helper)
  const getVal = (obj, key) => obj[key] || obj[key.toLowerCase()] || obj[key.toUpperCase()];

  const calories = getVal(plan, "Calories") || getVal(plan, "calories");
  const maintenance = plan["Maintenance Calories"] || plan.maintenance_calories;
  const macros = getVal(plan, "Macros") || getVal(plan, "macros") || {};
  
  // Diet plan object nikalo
  const dietPlanObj = getVal(plan, "Diet Plan") || getVal(plan, "diet_plan") || plan;

  let html = "";

  // --- OVERVIEW SECTION ---
  html += `<div class="plan-section-title">Overview</div>`;
  html += `<div style="margin-bottom:10px;">`;

  if (calories) html += `<span class="plan-tag">🔥 Target: <strong>${calories}</strong> kcal</span>`;
  if (maintenance) html += `<span class="plan-tag">⚖ Maintenance: <strong>${maintenance}</strong> kcal</span>`;
  
  // Macros Display
  const prot = getVal(macros, "Protein (g)") || getVal(macros, "protein") || "-";
  const carb = getVal(macros, "Carbs (g)") || getVal(macros, "carbs") || "-";
  const fats = getVal(macros, "Fats (g)") || getVal(macros, "fats") || "-";

  if (prot !== "-") {
    html += `<span class="plan-tag">🍽 Macros: P ${prot}g · C ${carb}g · F ${fats}g</span>`;
  }
  html += `</div>`;

  // --- MEALS SECTION ---
  // Standard keys list check karenge (Capital aur Small dono)
  const mealKeys = ["Breakfast", "Lunch", "Dinner", "Snacks", "Pre-Workout", "Post-Workout"];

  mealKeys.forEach((meal) => {
    // Helper se value nikalo (taaki 'breakfast' aur 'Breakfast' dono chalein)
    const value = getVal(dietPlanObj, meal); 
    
    if (!value) return; // Agar khali hai toh skip

    html += `<div class="plan-meal">
      <div class="plan-meal-title">${meal}</div>`;

    if (Array.isArray(value)) {
      html += `<ul class="plan-list">`;
      value.forEach((item) => {
        html += `<li>${escapeHtml(item)}</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<div>${escapeHtml(String(value))}</div>`;
    }

    html += `</div>`;
  });

  // Agar standard keys nahi mile, toh baki keys print kardo (Fallback)
  Object.keys(dietPlanObj).forEach(key => {
      // Jo hum already print kar chuke hain unhe ignore karein
      if ([...mealKeys, "Calories", "Macros", "Maintenance Calories", "diet_plan"].some(k => k.toLowerCase() === key.toLowerCase())) return;
      
      const val = dietPlanObj[key];
      if(typeof val === 'object' && val !== null && !Array.isArray(val)) return; // Nested objects ko skip karein

      html += `<div class="plan-meal">
        <div class="plan-meal-title">${escapeHtml(key)}</div>
        <div>${escapeHtml(String(val))}</div>
      </div>`;
  });

  return html;
}


function renderWorkoutPlanPretty(plan) {
  if (!plan || typeof plan !== "object") {
    return `<pre>${escapeHtml(JSON.stringify(plan, null, 2))}</pre>`;
  }

  const overview = plan["Workout Overview"] ?? plan.overview ?? {};
  const daysPlan = plan["Workout Plan"] ?? plan["Workout Plan "] ?? plan.workout_plan ?? plan;

  let html = "";

  // Overview tags (age, goal, days, location...)
  if (overview && typeof overview === "object") {
    html += `<div class="plan-section-title">Overview</div><div style="margin-bottom:10px;">`;

    if (overview.goal) {
      html += `<span class="plan-tag">🎯 Goal: <strong>${escapeHtml(
        overview.goal
      )}</strong></span>`;
    }
    if (overview.days_per_week) {
      html += `<span class="plan-tag">📅 Days: <strong>${
        overview.days_per_week
      }/week</strong></span>`;
    }
    if (overview.location) {
      html += `<span class="plan-tag">📍 Location: <strong>${escapeHtml(
        overview.location
      )}</strong></span>`;
    }
    if (overview.experience) {
      html += `<span class="plan-tag">💪 Level: <strong>${escapeHtml(
        overview.experience
      )}</strong></span>`;
    }
    html += `</div>`;
  }

  // Per-day workouts
  if (daysPlan && typeof daysPlan === "object") {
    Object.keys(daysPlan).forEach((dayName) => {
      const day = daysPlan[dayName];
      if (!day) return;

      html += `<div class="plan-day">
        <div class="plan-day-title">${escapeHtml(dayName)}</div>`;

      if (day["Warm-up"]) {
        html += `<div><strong>Warm-up:</strong> ${escapeHtml(
          String(day["Warm-up"])
        )}</div>`;
      }

      const exercises = day.Exercises ?? day.exercises ?? [];
      if (Array.isArray(exercises) && exercises.length) {
        html += `<ul class="plan-list">`;
        exercises.forEach((ex) => {
          if (typeof ex === "string") {
            html += `<li>${escapeHtml(ex)}</li>`;
          } else {
            const name = ex.name ?? "-";
            const sets = ex.sets ?? "";
            const reps = ex.reps ?? "";
            html += `<li><strong>${escapeHtml(
              name
            )}</strong> — ${escapeHtml(String(sets))} × ${escapeHtml(
              String(reps)
            )}</li>`;
          }
        });
        html += `</ul>`;
      }

      if (day["Cooldown"]) {
        html += `<div style="margin-top:6px;"><strong>Cooldown:</strong> ${escapeHtml(
          String(day["Cooldown"])
        )}</div>`;
      }

      html += `</div>`;
    });
  }

  return html;
}



function persistState() {
  localStorage.setItem("latestDietPlan", JSON.stringify(latestDietPlan));
  localStorage.setItem("latestWorkoutPlan", JSON.stringify(latestWorkoutPlan));
  localStorage.setItem("lastAIAdvice", JSON.stringify(lastAIAdvice));
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  localStorage.setItem("calorieTotal", calorieTotal.toString());
}

function restoreState() {
  latestDietPlan = JSON.parse(localStorage.getItem("latestDietPlan")) || {};
  latestWorkoutPlan = JSON.parse(localStorage.getItem("latestWorkoutPlan")) || {};
  lastAIAdvice = JSON.parse(localStorage.getItem("lastAIAdvice")) || "";
  chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
  calorieTotal = Number(localStorage.getItem("calorieTotal") || 0);

  // UI restore
  const calorieTotalSpan = document.getElementById("calorieTotal");
  if (calorieTotalSpan) calorieTotalSpan.textContent = calorieTotal;
}


// Save backend history (optional, from /export-summary)
function saveLocalHistory(history) {
  localStorage.setItem("fitness_history", JSON.stringify(history));
}

// ================= SAVE SUMMARY TO LOCAL STORAGE ================= //
//
// activityHistory = [
//   { date: "2025-11-30", calories: 1800, workout: {...} / "...", diet: {...} / "..." },
//   ...
// ]
//
function saveSummaryToLocalStorage(calories, workout, diet) {
  const today = new Date().toISOString().split("T")[0];

  const newEntry = {
    date: today,
    calories: calories,
    workout: workout,
    diet: diet,
  };

  const history = JSON.parse(localStorage.getItem("activityHistory")) || [];
  // Option A: har summary ek naya entry (even same day multiple times)
  history.unshift(newEntry);
  localStorage.setItem("activityHistory", JSON.stringify(history));
}

// ================== USER PROFILE HELPERS ================== //
function getUserProfile() {
  return {
    age: Number(document.getElementById("profile_age")?.value || 0),
    gender:
      (document.getElementById("profile_gender")?.value || "").toLowerCase(),
    height_cm: Number(document.getElementById("profile_height")?.value || 0),
    weight_kg: Number(document.getElementById("profile_weight")?.value || 0),
    goal: (document.getElementById("profile_goal")?.value || "").toLowerCase(),
    activity_level: (
      document.getElementById("profile_activity")?.value || ""
    ).toLowerCase(),
    food_preference: "veg", // you can link this from UI later
  };
}

// Helper function to call backend
async function callApi(path, payload) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API call failed:", err);
    alert(
      "Something went wrong talking to the backend. Check console for details."
    );
    return null;
  }
}

// ================== PROFILE ================== //

const pName = document.getElementById("profile_name");
const pAge = document.getElementById("profile_age");
const pWeight = document.getElementById("profile_weight");
const pHeight = document.getElementById("profile_height");
const pGender = document.getElementById("profile_gender");
const pGoal = document.getElementById("profile_goal");
const pActivity = document.getElementById("profile_activity");
const profileSaveBtn = document.getElementById("profileSaveBtn");

// Load saved profile (if any)
const savedProfileJson = localStorage.getItem("ai_fitness_profile");
if (savedProfileJson) {
  try {
    USER_PROFILE = JSON.parse(savedProfileJson);
    if (pName) pName.value = USER_PROFILE.name || "";
    if (pAge) pAge.value = USER_PROFILE.age || "";
    if (pWeight) pWeight.value = USER_PROFILE.weight_kg || "";
    if (pHeight) pHeight.value = USER_PROFILE.height_cm || "";
    if (pGender) pGender.value = USER_PROFILE.gender || "Select gender";
    if (pGoal) pGoal.value = USER_PROFILE.goal || "Select goal";
    if (pActivity)
      pActivity.value = USER_PROFILE.activity_level || "Select activity level";
  } catch (e) {
    console.error("Failed to parse saved profile:", e);
  }
}

if (profileSaveBtn) {
  profileSaveBtn.addEventListener("click", async () => {
    USER_PROFILE = {
      name: pName.value,
      age: Number(pAge.value),
      weight_kg: Number(pWeight.value),
      height_cm: Number(pHeight.value),
      gender: pGender.value,
      goal: pGoal.value,
      activity_level: pActivity.value,
    };

    // Browser me permanently save karo
    localStorage.setItem("ai_fitness_profile", JSON.stringify(USER_PROFILE));

    // Optional: backend ko bhi bhejo
    await callApi("/save-profile", USER_PROFILE);

    alert("Profile saved successfully!");
  });
}

// ================== PAGE SWITCHING ================== //

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");

function showPage(targetId) {
  pages.forEach((p) => p.classList.remove("active"));

  const target = document.getElementById(targetId);
  if (target) target.classList.add("active");

  navItems.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === targetId);
  });
}

navItems.forEach((btn) => {
  const target = btn.dataset.target;
  if (!target) return;
  btn.addEventListener("click", () => showPage(target));
});

// Quick actions on Dashboard
document.querySelectorAll(".quick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    if (target) showPage(target);
  });
});

// ================== DIET PLAN ================== //

const btnGenerateDiet = document.getElementById("btnGenerateDiet");
const dietResult = document.getElementById("dietResult");
const dietSelect = document.getElementById("dietPreference");

if (btnGenerateDiet) {
  btnGenerateDiet.addEventListener("click", async () => {
    const type = dietSelect.value;

    if (!type || type === "Select diet type") {
      dietResult.value = "⚠️ Please select a diet type first.";
      return;
    }

    dietResult.value = "⏳ Generating diet plan from AI backend...";
    
    const payload = {
      ...getUserProfile(), // form se live values
      ...USER_PROFILE, // agar profile save ki hui hai
      diet_type: type,
    };

    const data = await callApi("/diet", payload);
    if (!data) return;

    // Expect backend to return: { plan_text: "..." }

    


    // store structured diet plan if available
   latestDietPlan =
   data.diet_plan || data.plan || data.diet || { raw_text: data.plan_text };

    dietResult.innerHTML = renderDietPlanPretty(latestDietPlan);
   persistState();
  });
}

// ================== WORKOUT PLAN ================== //

const btnGenerateWorkout = document.getElementById("btnGenerateWorkout");
const workoutResult = document.getElementById("workoutResult");
const workoutExperience = document.getElementById("workoutExperience");
const workoutEquipment = document.getElementById("workoutEquipment");

if (btnGenerateWorkout) {
  btnGenerateWorkout.addEventListener("click", async () => {
    const exp = workoutExperience.value;
    const equip = workoutEquipment.value;

    if (
      !exp ||
      exp === "Select experience" ||
      !equip ||
      equip === "Select equipment"
    ) {
      workoutResult.value = "⚠️ Please select both experience and equipment.";
      return;
    }

    workoutResult.value = "⏳ Generating workout plan from backend...";

    const payload = {
      ...getUserProfile(), // profile form se
      ...USER_PROFILE, // saved profile se
      experience: exp,
      equipment: equip,
    };

    const data = await callApi("/workout", payload);
    if (!data) return;

    // Expect backend: { plan_text: "..." }
    
    
 

    // store structured workout plan if available
    latestWorkoutPlan =
    data.workout_plan || data.plan || data.workout || { raw_text: data.plan_text };


    workoutResult.innerHTML = renderWorkoutPlanPretty(latestWorkoutPlan);
   persistState();
  });
}

// ================== ADVANCED WORKOUT + DIET ================== //

const advAge = document.getElementById("adv_age");
const advGender = document.getElementById("adv_gender");
const advHeight = document.getElementById("adv_height");
const advWeight = document.getElementById("adv_weight");
const advGoal = document.getElementById("adv_goal");
const advLocation = document.getElementById("adv_location");
const advDays = document.getElementById("adv_days");
const advDaysValue = document.getElementById("adv_days_value");
const advExperience = document.getElementById("adv_experience");
const advActivity = document.getElementById("adv_activity");
const advFood = document.getElementById("adv_food");

const btnAdvGenerate = document.getElementById("btnAdvGenerate");
const advOutputCard = document.getElementById("adv_output");
const advWorkoutJson = document.getElementById("adv_workout_json");
const advDietJson = document.getElementById("adv_diet_json");

// Update days slider label
if (advDays && advDaysValue) {
  advDays.addEventListener("input", () => {
    advDaysValue.textContent = advDays.value;
  });
}

if (btnAdvGenerate) {
  btnAdvGenerate.addEventListener("click", async () => {
    const user = {
      age: Number(advAge.value || 0),
      gender: advGender.value,
      height_cm: Number(advHeight.value || 0),
      weight_kg: Number(advWeight.value || 0),
      goal: advGoal.value,
      location: advLocation.value,
      days_per_week: Number(advDays.value || 0),
      experience: advExperience.value,
      activity_level: advActivity.value,
      food_preference: advFood.value,
    };

    // Validation
    if (!user.age || !user.height_cm || !user.weight_kg || !user.goal) {
      alert("Please fill all the required fields for advanced plan.");
      return;
    }

    advWorkoutJson.textContent = "⏳ Generating...";
    advDietJson.textContent = "";
    advOutputCard.style.display = "block";

    const data = await callApi("/advanced-plan", {
      ...USER_PROFILE,
      ...user,
    });

    if (!data) return;

    

    // ------------------------
    // CORRECT WORKOUT JSON
    // ------------------------
    const advWorkoutPlan =
      data.workout_json ||
      data.meta?.advanced_plan?.["Workout Plan"] ||
      {};

    advWorkoutJson.innerHTML = renderWorkoutPlanPretty(advWorkoutPlan);



    // ------------------------
    // CORRECT DIET JSON (FIX)
    // ------------------------
    // ------------------------
    // PROFESSIONAL FIX: Robust Data Fetching
    // ------------------------
    // Backend se aane wale alag-alag potential keys ko check karein
    let rawDiet = 
      data.diet_json || 
      data.diet_plan || 
      data.diet || 
      data.meta?.advanced_plan?.["Diet Plan"] || 
      {};

    // Agar data string format me hai (kabhi kabhi AI text bhej deta hai), toh parse karein
    if (typeof rawDiet === "string") {
        try {
            rawDiet = JSON.parse(rawDiet);
        } catch (e) {
            console.error("Failed to parse diet JSON string", e);
            rawDiet = { raw_text: rawDiet };
        }
    }

    const advDietPlan = rawDiet;

    


    // SAVE LATEST
    latestWorkoutPlan = advWorkoutPlan;
    latestDietPlan = advDietPlan;
    advDietJson.innerHTML = renderDietPlanPretty(advDietPlan);
    persistState();
  });
}



// ================== CALORIE TRACKER ================== //

const calorieInput = document.getElementById("calorieInput");
const calorieTotalSpan = document.getElementById("calorieTotal");
const calorieList = document.getElementById("calorieList");
const btnAddFood = document.getElementById("btnAddFood");

if (btnAddFood) {
  btnAddFood.addEventListener("click", async () => {
    const text = (calorieInput.value || "").trim();
    if (!text) return;

    const payload = { food_text: text };

    const data = await callApi("/calories", payload);
    if (!data) return;

    // Expect backend: { total: number, details: "line1\nline2..." }
    calorieTotal = data.total ?? calorieTotal;
    calorieTotalSpan.textContent = calorieTotal;

    const li = document.createElement("li");
    li.textContent = `${text} – estimated via AI`;
    calorieList.appendChild(li);

    console.log("Calorie details from backend:", data.details);

    calorieInput.value = "";
    persistState();

  });
}

// ================== AI COACH RECOMMENDATION ================== //

const btnGetRecommendation = document.getElementById("btnGetRecommendation");
const recOutput = document.getElementById("rec_output");
const recText = document.getElementById("rec_text");

if (btnGetRecommendation) {
  btnGetRecommendation.addEventListener("click", async () => {
    recOutput.style.display = "block";
    recText.textContent = "⏳ Fetching AI recommendation from backend...";

    const payload = {
      ...getUserProfile(),
      ...USER_PROFILE,
      last_calories: calorieTotal,
    };

    const data = await callApi("/recommendation", payload);
    if (!data) return;

    // Expect backend: { advice: "..." }
    const adviceText = data.advice || JSON.stringify(data, null, 2);

    // show in pretty structured format
    recText.innerHTML = renderMarkdown(adviceText);

    // also store plain text (for PDF etc.)
    lastAIAdvice = adviceText;

    persistState();

  });
}

// ================== AI COACH CHAT ================== //

const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatMessages = document.getElementById("chatMessages");

function appendMessage(text, role) {
  const msg = document.createElement("div");
  msg.classList.add("msg", role);

  const content = document.createElement("div");
  content.classList.add("msg-content");
  
  // ✅ User messages: plain text
  // ✅ Bot messages: formatted using our markdown helper
  if (role === "bot") {
    content.innerHTML = renderMarkdown(text);
  } else {
    content.textContent = text;
  }


  const meta = document.createElement("div");
  meta.classList.add("msg-meta");
  const now = new Date();
  meta.textContent = now.toLocaleTimeString();

  msg.appendChild(content);
  msg.appendChild(meta);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat() {
  const text = (chatInput.value || "").trim();
  if (!text) return;

  appendMessage(text, "user");
  chatHistory.push({ role: "user", content: text });
  persistState();

  chatInput.value = "";

  appendMessage("Thinking...", "bot");

  const data = await callApi("/chat", { message: text, history: chatHistory });
  if (!data) return;

  const lastMsg = chatMessages.lastElementChild;
  if (lastMsg) lastMsg.remove();

  const reply = data.reply || "Sorry, I couldn't generate a response.";
  appendMessage(reply, "bot");
  chatHistory.push({ role: "assistant", content: reply });
  persistState();
}

if (chatSendBtn) {
  chatSendBtn.addEventListener("click", sendChat);
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  });
}

// ================== ACTIVITY HISTORY RENDER ================== //

function renderHistory() {
  const historyContainer = document.getElementById("historyList");
  if (!historyContainer) return;

  const history = JSON.parse(localStorage.getItem("activityHistory")) || [];

  historyContainer.innerHTML = "";

  history.forEach((entry) => {
    historyContainer.innerHTML += `
      <div class="activity-item">
        <div>
          <div class="activity-date">${entry.date}</div>
          <div class="activity-meta">
            <span>Calories: <strong>${entry.calories ?? 0} kcal</strong></span>
            <span>Workout: <strong>${
              typeof entry.workout === "string"
                ? entry.workout
                : entry.workout && entry.workout.title
                ? entry.workout.title
                : "-"
            }</strong></span>
            <span>Diet Plan: <strong>${
              typeof entry.diet === "string"
                ? entry.diet
                : entry.diet && entry.diet.title
                ? entry.diet.title
                : "-"
            }</strong></span>
          </div>
        </div>
      </div>
    `;
  });
}

// ================== WEEKLY CALORIE CHART ================== //

function recomputeWeeklyCalories() {
  weeklyCalories = [0, 0, 0, 0, 0, 0, 0];

  const history = JSON.parse(localStorage.getItem("activityHistory")) || [];

  history.forEach((entry) => {
    if (!entry.date || typeof entry.calories !== "number") return;

    const d = new Date(entry.date);
    if (isNaN(d)) return;

    let idx = d.getDay(); // Sunday = 0
    idx = idx === 0 ? 6 : idx - 1; // Monday=0, Sunday=6

    weeklyCalories[idx] = entry.calories;
  });
}

function updateChart() {
  const ctx = document.getElementById("calorieChart");
  if (!ctx || !window.Chart) return;

  recomputeWeeklyCalories();

  if (calorieChart) {
    calorieChart.destroy();
  }

  calorieChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "Calories",
          data: weeklyCalories,
          borderWidth: 2,
          tension: 0.4,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(148,163,184,0.15)" },
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
      },
    },
  });
}

// ===================== SAVE SUMMARY (MAIN FUNCTION) ===================== //

const btnSaveSummary = document.getElementById("btnSaveSummary");

function buildSummaryPayload() {
  return {
    username: USER_PROFILE.name || "User",
    calories: calorieTotal,
    diet_plan: latestDietPlan,
    workout_plan: latestWorkoutPlan,
    ai_advice: lastAIAdvice,
    chat_history: chatHistory,
  };
}

if (btnSaveSummary) {
  btnSaveSummary.addEventListener("click", async () => {
    // 1) Local storage me save karo (permanent for that browser)
    saveSummaryToLocalStorage(calorieTotal, latestWorkoutPlan, latestDietPlan);
    persistState();

    // 2) UI ko refresh karo (history + chart)
    renderHistory();
    updateChart();

    // 3) Backend ko PDF ke liye call karo
    const payload = buildSummaryPayload();
    const res = await callApi("/export-summary", payload);

    if (res && res.success) {
      // Optional: backend history bhi store kar sakte ho
      if (res.history) {
        saveLocalHistory(res.history);
      }
      alert("Summary saved + PDF generated!");
    } else {
      alert("Failed to save summary");
    }
  });
}

// ========== DOWNLOAD PDF ========== //
const btnDownloadPDF = document.getElementById("btnDownloadPDF");

if (btnDownloadPDF) {
  btnDownloadPDF.addEventListener("click", async () => {
    const payload = buildSummaryPayload();
    const res = await callApi("/export-summary", payload);

    if (res && res.pdf_url) {
      window.open(res.pdf_url, "_blank");
    } else {
      alert("Failed to generate PDF.");
    }
  });
}

// ================== ON PAGE LOAD ================== //

window.addEventListener("load", () => {
  // initial render
  restoreState(); 
  renderHistory();
  updateChart();
});



