// =================== GLOBAL VARIABLES =================== //
let latestDietPlan = {};
let latestWorkoutPlan = {};
let lastAIAdvice = "";
let chatHistory = [];
let calorieTotal = 0; // Default 0
let calorieChart = null;
let goalCalories = 0;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
let FIRST_LOAD = true;

// document.addEventListener("submit", (e) => {
//     e.preventDefault();
// });


// =================== API BASE URL =================== //
// Change this to your backend URL + port
const API_BASE = "http://localhost:8000";

// ------------- AUTH CONFIG -------------
const BASE_URL = API_BASE;  // same as backend

function saveAuth(token, userId) {
  localStorage.setItem("authToken", token);
  localStorage.setItem("authUserId", userId);
}

function getToken() {
  return localStorage.getItem("authToken");
}

function clearAuth() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUserId");
}

// Protected API ke liye helper
function getAuthHeaders() {
  const token = getToken();
  return token ? { "Authorization": "Bearer " + token } : {};
}

// ==========================================
// FINAL FIXED LOGIN FUNCTION
// ==========================================
async function handleLogin(event) {
  event.preventDefault();

  const btn = event.target.querySelector("button[type='submit']");
  const originalText = btn.innerText;
  btn.innerText = "Logging in...";
  btn.disabled = true;

  const email = document.getElementById("login_email").value.trim();
  const password = document.getElementById("login_password").value.trim();

  try {
    // 🔥 THIS IS THE ONLY CORRECT URL
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail || "Invalid email or password", "error");
    } else {
      showToast("Login Successful!", "success");
      saveAuth(data.token, data.user_id);

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    }
  } catch (err) {
    console.error(err);
    showToast("Server error. Try again", "error");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}


// ------------- LOGOUT -------------
function handleLogout() {
  clearAuth();
  // 🔥 Purana profile data bhi delete karo
  localStorage.removeItem("ai_fitness_profile"); 
  localStorage.removeItem("latestDietPlan");
  localStorage.removeItem("latestWorkoutPlan");
  
  window.location.href = "index.html";
}

function switchToLogin() {
  document.getElementById("login-section").style.display = "block";
  document.getElementById("register-section").style.display = "none";
}

function switchToRegister() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "block";
}


// ---------Dshboard 3 BoXes-----------------

function updateDashboardMetrics() {
  // ---- 1) BMI calculation ----
  const h = USER_PROFILE.height_cm;
  const w = USER_PROFILE.weight_kg;

  if (h && w) {
    const bmi = (w / ((h / 100) ** 2)).toFixed(1);
    document.getElementById("bmiValue").textContent = bmi;

    let status = "Normal Range";
    if (bmi < 18.5) status = "Underweight";
    else if (bmi > 24.9) status = "Overweight";

    document.getElementById("bmiStatus").textContent = status;
  }

  // ---- 2) Daily calorie goal ----
  let dailyGoal = 2000;
  const age = USER_PROFILE.age || 25;
  const gender = USER_PROFILE.gender || "male";
  const activity = USER_PROFILE.activity_level || "moderately active";

  if (h && w && age) {
    let BMR = 0;

    // Mifflin-St Jeor Equation (professional)
    if (gender === "male") {
      BMR = 10 * w + 6.25 * h - 5 * age + 5;
    } else {
      BMR = 10 * w + 6.25 * h - 5 * age - 161;
    }

    const multipliers = {
      "sedentary": 1.2,
      "lightly active": 1.375,
      "moderately active": 1.55,
      "very active": 1.725,
    };

    dailyGoal = Math.round(BMR * (multipliers[activity] || 1.55));
  }

  document.getElementById("dailyGoal").textContent = dailyGoal;

  // ---- 3) Today's progress ----
  const todayCals = calorieTotal;
  document.getElementById("todayCalories").textContent = todayCals;

  const progress = Math.round((todayCals / dailyGoal) * 100) || 0;
  document.getElementById("todayProgress").textContent = `${progress}% of goal`;
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


// For chart
let weeklyCalories = [0, 0, 0, 0, 0, 0, 0];




/* =========================================
   NEW PROFESSIONAL DIET RENDERER (With Emojis)
   ========================================= */
function renderDietPlanPretty(plan) {
  if (!plan || typeof plan !== "object") {
    return `<div class="error-box">⚠️ Invalid Data Format</div>`;
  }

  // --- Helper: Safe Value Fetcher ---
  const getVal = (obj, key) => {
    if (!obj) return undefined;
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey ? obj[foundKey] : undefined;
  };

  let html = `<div class="diet-container animate-fade-in">`;

  // --- 1. NUTRITION SUMMARY (Top Dashboard) ---
  const calories = getVal(plan, "Calories") || getVal(plan, "calories");
  const macros = getVal(plan, "Macros") || getVal(plan, "macros");
  
  if (calories || macros) {
    html += `<div class="diet-summary-card">
      <div class="summary-header">
        <i class="fa-solid fa-chart-pie"></i> Nutrition Targets
      </div>
      <div class="macros-grid">`;
      
    // 🔥 CALORIES BOX
    if (calories) {
      html += `<div class="macro-box cal">
        <div class="macro-val">${calories}</div>
        <div class="macro-label">🔥 Kcal</div>
      </div>`;
    }

    if (macros) {
      const p = getVal(macros, "Protein (g)") || getVal(macros, "protein") || "-";
      const c = getVal(macros, "Carbs (g)") || getVal(macros, "carbs") || "-";
      const f = getVal(macros, "Fats (g)") || getVal(macros, "fats") || "-";
      
      // 🥩 PROTEIN BOX
      if(p !== '-') html += `<div class="macro-box pro"><div class="macro-val">${p}g</div><div class="macro-label">🥩 Protein</div></div>`;
      
      // 🍞 CARBS BOX
      if(c !== '-') html += `<div class="macro-box carb"><div class="macro-val">${c}g</div><div class="macro-label">🍞 Carbs</div></div>`;
      
      // 🥑 FATS BOX
      if(f !== '-') html += `<div class="macro-box fat"><div class="macro-val">${f}g</div><div class="macro-label">🥑 Fats</div></div>`;
    }
    html += `</div></div>`; // End Summary
  }

  // --- 2. DETECT DAYS (Single or Multi) ---
  const dietPlanObj = getVal(plan, "Diet Plan") || getVal(plan, "diet_plan") || plan;
  const keys = Object.keys(dietPlanObj);
  const dayKeys = keys.filter(k => k.toLowerCase().includes("day") || k.toLowerCase().includes("monday"));

  // --- Helper: Render Meals List ---
  const renderMeals = (mealsObj) => {
    let mealHtml = `<div class="meals-list">`;
    const icons = {
      "breakfast": "fa-mug-hot",
      "lunch": "fa-bowl-rice",
      "dinner": "fa-utensils",
      "snacks": "fa-apple-whole",
      "pre-workout": "fa-bolt",
      "post-workout": "fa-glass-water",
      "mid-morning": "fa-sun"
    };

    // Standard Ordering
    const order = ["Breakfast", "Mid-Morning", "Lunch", "Evening Snack", "Snacks", "Dinner", "Pre-Workout", "Post-Workout"];
    
    // Print in order
    order.forEach(type => {
      const val = getVal(mealsObj, type);
      if(val) {
        const iconClass = icons[type.toLowerCase()] || "fa-circle-dot";
        mealHtml += `
        <div class="meal-item">
          <div class="meal-icon-box"><i class="fa-solid ${iconClass}"></i></div>
          <div class="meal-content">
            <div class="meal-title">${type}</div>
            <div class="meal-desc">${escapeHtml(Array.isArray(val) ? val.join(", ") : val)}</div>
          </div>
        </div>`;
      }
    });

    // Print remaining keys
    Object.keys(mealsObj).forEach(k => {
      if(order.some(o => o.toLowerCase() === k.toLowerCase())) return; // skip already done
      if(["calories", "macros"].includes(k.toLowerCase())) return; // skip metadata

      const val = mealsObj[k];
      if(typeof val === 'string' || Array.isArray(val)) {
        mealHtml += `
        <div class="meal-item">
          <div class="meal-icon-box"><i class="fa-solid fa-star"></i></div>
          <div class="meal-content">
            <div class="meal-title">${k}</div>
            <div class="meal-desc">${escapeHtml(Array.isArray(val) ? val.join(", ") : val)}</div>
          </div>
        </div>`;
      }
    });

    mealHtml += `</div>`;
    return mealHtml;
  };

  // --- 3. RENDER CARDS ---
  html += `<div class="days-grid-layout">`;

  if (dayKeys.length > 0) {
    // Sort Days
    dayKeys.sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));

    dayKeys.forEach(day => {
      html += `
      <div class="diet-day-card">
        <div class="day-badge">${day}</div>
        ${renderMeals(dietPlanObj[day])}
      </div>`;
    });
  } else {
    // Single Day View
    html += `
    <div class="diet-day-card single-mode">
      <div class="day-badge">Daily Plan</div>
      ${renderMeals(dietPlanObj)}
    </div>`;
  }

  html += `</div></div>`; // End container
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
  // DB snapshot ab backend ke through hota hai (export-summary pe).
  // Yahan hum kuch nahi karte, sirf debug log:
  console.log("persistState(): in-memory update only. DB save happens on 'Save Summary'.");
}


// function restoreState() {
//   function restoreState() {
//   // ❌ We do not restore ANYTHING from localStorage.
//   // The UI will be populated from backend via fetchUserProfileFromDB().
  
//   latestDietPlan = {};
//   latestWorkoutPlan = {};
//   lastAIAdvice = "";
//   chatHistory = [];
//   calorieTotal = 0;
//  }

  

//   // UI restore
//   const calorieTotalSpan = document.getElementById("calorieTotal");
//   if (calorieTotalSpan) calorieTotalSpan.textContent = calorieTotal;
// }


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
// function saveSummaryToLocalStorage(calories, workout, diet) {
//   const today = new Date().toISOString().split("T")[0];

//   const newEntry = {
//     date: today,
//     calories: calories,
//     workout: workout,
//     diet: diet,
//   };

//   const history = JSON.parse(localStorage.getItem("activityHistory")) || [];
//   // Option A: har summary ek naya entry (even same day multiple times)
//   history.unshift(newEntry);
//   localStorage.setItem("activityHistory", JSON.stringify(history));
// }

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
// ==========================================
// NEW CALL API FUNCTION (WITH TOKEN)
// ==========================================
async function callApi(path, payload) {
  const token = localStorage.getItem("authToken"); // LocalStorage se token nikala
  
  const headers = { 
    "Content-Type": "application/json" 
  };

  // Agar token maujood hai, to usse header me add karo
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload || {}),
    });

    // Agar token expire ho gaya hai (401 Error), to logout karo
    if (res.status === 401) {
        alert("Session expired. Please login again.");
        window.location.href = "index.html";
        return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API call failed:", err);
    return null;
  }
}


// --- Helper Function for Dropdowns (Crash Proof) ---
function setDropdownValue(elementId, value) {
    const select = document.getElementById(elementId);
    // Value ko String me convert karo taaki null/undefined par crash na ho
    const safeValue = String(value || "").toLowerCase(); 

    if (!select || !safeValue) return;

    for (let i = 0; i < select.options.length; i++) {
        const optText = select.options[i].text.toLowerCase();
        const optVal = select.options[i].value.toLowerCase();

        if (optVal === safeValue || optText === safeValue || optVal.includes(safeValue)) {
            select.selectedIndex = i;
            break;
        }
    }
}

// Function: Update Dashboard UI (Animation controlled)
function applyDashboardEffects(bmi, targetCalories, calorieTotal, animate = true) {
    const bar = document.getElementById("progressBarFill");
    if (!bar) return;

    let pct = targetCalories > 0 ? (calorieTotal / targetCalories) * 100 : 0;
    if (pct > 100) pct = 100;

    // 🔥 FIX: Agar animate=false hai (Page Load par), to transition hatado
    if (!animate) {
        bar.style.transition = "none"; 
        bar.style.width = pct + "%";
    } else {
        // Normal update (Add Food par) - Smooth Transition
        bar.style.transition = "width 0.6s ease-out";
        bar.style.width = pct + "%";
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
// const savedProfileJson = localStorage.getItem("ai_fitness_profile");
// if (savedProfileJson) {
//   try {
//     USER_PROFILE = JSON.parse(savedProfileJson);
//     if (pName) pName.value = USER_PROFILE.name || "";
//     if (pAge) pAge.value = USER_PROFILE.age || "";
//     if (pWeight) pWeight.value = USER_PROFILE.weight_kg || "";
//     if (pHeight) pHeight.value = USER_PROFILE.height_cm || "";
//     if (pGender) pGender.value = USER_PROFILE.gender || "Select gender";
//     if (pGoal) pGoal.value = USER_PROFILE.goal || "Select goal";
//     if (pActivity)
//       pActivity.value = USER_PROFILE.activity_level || "Select activity level";
//   } catch (e) {
//     console.error("Failed to parse saved profile:", e);
//   }
// }

async function apiGet(path) {
    const token = localStorage.getItem("authToken");

    const headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "GET",
            headers: headers
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`GET error ${res.status}: ${text}`);
        }

        return await res.json();
    } catch (err) {
        console.error("GET API failed:", err);
        return null;
    }
}


// ==========================================
// 🚀 FIXED: FETCH PROFILE (SAFE VERSION)
// ==========================================
async function fetchUserProfileFromDB() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    console.log("🔄 Fetching profile & progress...");

    try {
        const res = await fetch(`${BASE_URL}/auth/me`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 401) {
            handleLogout();
            return;
        }
        
        const data = await res.json();
        const user = data.user || data.data;
        const progress = data.today_progress;
        const lastSession = data.last_session || {};

        if (user) {
            // 1. Global Variable Update (Safe Defaults ke sath)
            USER_PROFILE = {
                name: user.name || "",
                email: user.email || "",
                age: Number(user.age) || 0,
                gender: user.gender || "",
                height_cm: Number(user.height || user.height_cm || 0),
                weight_kg: Number(user.weight || user.weight_kg || 0),
                goal: user.goal || "",
                activity_level: user.activity_level || "sedentary"
            };

            // 2. UI INPUTS FILLING (Sirf agar element maujood ho)
            const safelySetValue = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };

            safelySetValue("profile_name", USER_PROFILE.name);
            safelySetValue("profile_age", USER_PROFILE.age);
            safelySetValue("profile_weight", USER_PROFILE.weight_kg);
            safelySetValue("profile_height", USER_PROFILE.height_cm);

            // Dropdowns
            if (document.getElementById("profile_gender")) 
                setDropdownValue("profile_gender", USER_PROFILE.gender);
            
            if (document.getElementById("profile_goal")) 
                setDropdownValue("profile_goal", USER_PROFILE.goal);
            
            if (document.getElementById("profile_activity")) 
                setDropdownValue("profile_activity", USER_PROFILE.activity_level);

            // 3. RESTORE TODAY'S CALORIES (pure DB-based)
            if (progress && typeof progress.calories === "number") {
                calorieTotal = progress.calories;
            } else {
                console.warn("⚠️ No progress found for today — no calories yet.");
                calorieTotal = 0;
            }
            goalCalories = progress?.daily_goal || 2000;

            const calorieTotalSpan = document.getElementById("calorieTotal");
            if (calorieTotalSpan) calorieTotalSpan.textContent = calorieTotal;

            // 4. RESTORE LAST SESSION (diet, workout, advice, chat)
            const dietResult = document.getElementById("dietResult");
            const workoutResult = document.getElementById("workoutResult");
            const recText = document.getElementById("recText"); // AI recommendation output
            const chatMessages = document.getElementById("chatMessages");

            if (lastSession.diet_plan && dietResult) {
                latestDietPlan = lastSession.diet_plan;
                dietResult.innerHTML = renderDietPlanPretty(latestDietPlan);
            }

            if (lastSession.workout_plan && workoutResult) {
                latestWorkoutPlan = lastSession.workout_plan;
                workoutResult.innerHTML = renderWorkoutPlanPretty(latestWorkoutPlan);
            }

            if (lastSession.ai_advice && recText) {
                lastAIAdvice = lastSession.ai_advice;
                recText.innerHTML = renderMarkdown(lastAIAdvice);
            }

            if (Array.isArray(lastSession.chat_history) && chatMessages) {
                chatHistory = lastSession.chat_history;
                chatMessages.innerHTML = "";
                chatHistory.forEach(msg => {
                    const role = msg.role === "assistant" ? "bot" : "user";
                    appendMessage(msg.content, role);
                });
            }

            // 4. Update Dashboard (With NO Animation on load)
            if (typeof updateDashboardMetrics === "function") {
                updateDashboardMetrics();
                
                // Calculate values for bar
                const bmi = (USER_PROFILE.weight_kg / ((USER_PROFILE.height_cm/100)**2)).toFixed(1);
                // (BMR calculation logic same as before...)
                // ...
                // 🔥 CALL WITH animate = FALSE
                applyDashboardEffects(bmi, goalCalories, calorieTotal, false);
            }
        }

    } catch (e) {
        console.error("❌ Failed to fetch profile:", e);
    }
}

// ================== PAGE SWITCHING ================== //

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");

function showPage(targetId) {
  pages.forEach((p) => p.classList.remove("active"));

  const target = document.getElementById(targetId);
  if (target) target.classList.add("active");
  if (targetId === "history") {
    updateChart();
}

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
        // 1) dropdown ka value lo (Vegetarian / Non-Vegetarian / Vegan)
    const type = dietSelect.value;

    if (!type || type === "Select diet type") {
      dietResult.value = "⚠️ Please select a diet type first.";
      return;
    }

    dietResult.value = "⏳ Generating diet plan from AI backend...";

    // 2) is text ko food_preference me map karo
    let foodPref = "veg";  // default
    const t = type.toLowerCase();

    if (t.includes("non-veg")) {
      foodPref = "non-vegetarian";
    } else if (t.includes("vegan")) {
      foodPref = "vegan";
    } else {
      foodPref = "veg";  // Vegetarian
    }

    // 3) backend ko sahi key ke saath bhejo
    const payload = {
      ...getUserProfile(),
      ...USER_PROFILE,
      food_preference: foodPref,   // 🔥 IMPORTANT
      // diet_type: type,          // optional: chaho to hata do
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


// ================== CALORIE TRACKER (DB CONNECTED) ================== //

const calorieInput = document.getElementById("calorieInput");
const calorieTotalSpan = document.getElementById("calorieTotal");
const calorieList = document.getElementById("calorieList");
const btnAddFood = document.getElementById("btnAddFood");

if (btnAddFood) {
  btnAddFood.addEventListener("click", async () => {
    const text = (calorieInput.value || "").trim();
    if (!text) return;

    // Show loading state
    const originalText = btnAddFood.innerHTML;
    btnAddFood.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnAddFood.disabled = true;

    const payload = { food_text: text };

    // 🔥 Call Backend API (which now saves to MongoDB)
    const data = await callApi("/calories", payload);
    
    // Restore button
    btnAddFood.innerHTML = originalText;
    btnAddFood.disabled = false;

    if (!data) return;

    // 🔥 IMPORTANT: Use the Total calculated by the Backend
    // This ensures data stays synced even if you refresh or switch devices
    calorieTotal = data.total || 0; 
    
    // UI Updates
    calorieTotalSpan.textContent = calorieTotal;
    
    if (typeof updateDashboardMetrics === "function") {
        updateDashboardMetrics();
    }

    const profile = getUserProfile();
    // Re-calculate BMI/Goal for visual effects
    const weight = profile.weight_kg || 0;
    const height = profile.height_cm || 0;
    const age = profile.age || 0;
    const bmi = (weight && height) ? (weight / ((height/100)**2)).toFixed(1) : 0;
    
    let BMR = 10 * weight + 6.25 * height - 5 * age + (profile.gender === "male" ? 5 : -161);
    const multipliers = {
      "sedentary": 1.2, "lightly active": 1.375, "moderately active": 1.55, "very active": 1.725,
    };
    const goalCalories = Math.round(BMR * (multipliers[profile.activity_level] || 1.55));

    if (typeof applyDashboardEffects === "function") {
        applyDashboardEffects(bmi, goalCalories, calorieTotal);
    }
    
    // Add to list visually
    const li = document.createElement("li");
    const addedCals = data.details?.total_calories || 0; // Get just the added amount for display
    li.innerHTML = `<strong>${text}</strong> <span style="color:#a5b4fc;">(+${Math.round(addedCals)} kcal)</span>`;
    calorieList.appendChild(li);

    console.log("Updated Total from DB:", calorieTotal);
    calorieInput.value = "";
    
    if (typeof updateChart === "function") updateChart();
    await updateChart();

    
    // ❌ REMOVED: persistState(); (We don't need localStorage for this anymore)
  });
}

// ================== CALORIE MIC VOICE INPUT ================== //

// mic button = calorie section ke wrapper ka 2nd button
const micBtn = document.querySelector(
  "#calories .calorie-input-wrapper button:nth-of-type(2)"
);

// Browser me speech recognition available hai ya nahi
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (micBtn && SpeechRecognition) {
  const recognition = new SpeechRecognition();

  // Hindi + English mix ke liye "hi-IN" bhi set kar sakte ho
  // recognition.lang = "en-US";
  recognition.lang = "en-IN";
  recognition.interimResults = false; // sirf final result
  recognition.maxAlternatives = 1;

  let listening = false;

  micBtn.addEventListener("click", () => {
    if (!listening) {
      listening = true;
      recognition.start();

      // user ko feedback (layout change nahi, sirf placeholder)
      const oldPlaceholder = calorieInput.placeholder;
      calorieInput.dataset.oldPlaceholder = oldPlaceholder;
      calorieInput.placeholder = "Listening... speak your food item 🎙️";
    } else {
      // dobara click kare to stop
      listening = false;
      recognition.stop();
    }
  });

  recognition.addEventListener("result", (event) => {
    listening = false;

    const transcript = event.results[0][0].transcript;
    console.log("Heard:", transcript);

    // text box me set karo
    calorieInput.value = transcript;

    // placeholder normal karo
    if (calorieInput.dataset.oldPlaceholder) {
      calorieInput.placeholder = calorieInput.dataset.oldPlaceholder;
      delete calorieInput.dataset.oldPlaceholder;
    }

    // OPTIONAL: auto-add bhi kar sakte ho
    // btnAddFood.click();
  });

  recognition.addEventListener("end", () => {
    listening = false;
    // agar user ne manual stop kiya, placeholder wapas normal
    if (calorieInput.dataset.oldPlaceholder) {
      calorieInput.placeholder = calorieInput.dataset.oldPlaceholder;
      delete calorieInput.dataset.oldPlaceholder;
    }
  });

  recognition.addEventListener("error", (event) => {
    listening = false;
    console.error("Speech recognition error:", event.error);
    alert("Mic recognition error: " + event.error);

    if (calorieInput.dataset.oldPlaceholder) {
      calorieInput.placeholder = calorieInput.dataset.oldPlaceholder;
      delete calorieInput.dataset.oldPlaceholder;
    }
  });
} else {
  console.log("SpeechRecognition not supported in this browser.");
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

// ================== RENDER HISTORY (EXPANDABLE + 3-DOT MENU) ================== //
let _globalHistoryData = [];   // already at top, keep this

// ================== RENDER HISTORY (FULL-WIDTH + CONTEXT MENU) ================== //
async function renderHistory() {
    const container = document.getElementById("historyList");
    if (!container) return;

    const token = localStorage.getItem("authToken");
    if (!token) {
        container.innerHTML = "<p style='color:#888;'>Please login to see history.</p>";
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/history/list`, {
            method: "GET",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await res.json();

        if (!data.history || data.history.length === 0) {
            container.innerHTML = "<p style='color:#888;'>No saved history yet.</p>";
            return;
        }

        _globalHistoryData = data.history;
        container.innerHTML = "";

        data.history.forEach((item, index) => {
            const dateObj = new Date(item.date);
            const dateStr = dateObj.toLocaleString();
            const historyId = item._id;
            const sessionTitle = item.title || `Session ${index + 1}`;

            const card = document.createElement("div");
            card.className = "history-item";

            card.innerHTML = `
                <div class="history-header">
                    <div class="history-main">
                        <div class="history-icon">📁</div>
                        <div class="history-info">
                            <div class="history-title">${escapeHtml(sessionTitle)}</div>
                            <div class="history-date">${escapeHtml(dateStr)}</div>
                        </div>
                    </div>

                    <div class="history-actions">
                        <div class="history-kcal">${item.calories || 0} kcal</div>
                        <button class="history-menu-btn" aria-label="Session menu">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                    </div>
                </div>

                <div class="history-content hidden">
                    <p><strong>Date:</strong> ${escapeHtml(dateStr)}</p>

                    <h4 class="history-subtitle">🍽️ Diet Plan</h4>
                    <div class="pretty-result">
                        ${renderDietPlanPretty(item.diet_plan || {})}
                    </div>

                    <h4 class="history-subtitle">💪 Workout Plan</h4>
                    <div class="pretty-result">
                        ${renderWorkoutPlanPretty(item.workout_plan || {})}
                    </div>

                    <h4 class="history-subtitle">🤖 AI Advice</h4>
                    <div class="history-advice-box">
                        ${renderMarkdown(item.ai_advice || "No advice saved.")}
                    </div>

                    <h4 class="history-subtitle">💬 Chat History</h4>
                    <div class="history-chat-box">
                       ${renderChatHistoryPretty(item.chat_history || [])}
                     </div>

                </div>

                <!-- Context Menu -->
                <div class="history-menu-panel hidden">
                    <button class="history-menu-item" data-action="popup">
                        <i class="fa-solid fa-up-right-from-square"></i>
                        <span>Open in popup</span>
                    </button>
                    <button class="history-menu-item" data-action="toggle">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>Expand / collapse</span>
                    </button>
                    <button class="history-menu-item" data-action="download">
                        <i class="fa-solid fa-file-arrow-down"></i>
                        <span>Download summary</span>
                    </button>
                    <button class="history-menu-item" data-action="rename">
                        <i class="fa-solid fa-pen"></i>
                        <span>Rename session</span>
                    </button>
                    <button class="history-menu-item danger" data-action="delete">
                        <i class="fa-solid fa-trash"></i>
                        <span>Delete session</span>
                    </button>
                </div>
            `;

            const header = card.querySelector(".history-header");
            const content = card.querySelector(".history-content");
            const menuBtn = card.querySelector(".history-menu-btn");
            const menuPanel = card.querySelector(".history-menu-panel");
            const titleEl = card.querySelector(".history-title");

            // ⭐ FIXED MENU ITEM HANDLER (PASTE EXACTLY HERE)
menuPanel.querySelectorAll(".history-menu-item").forEach(item => {
    item.addEventListener("click", (e) => {

        // Prevent card header click from triggering
        e.preventDefault();
        e.stopPropagation();

        const action = item.dataset.action;

        // Close menu
        menuPanel.classList.add("hidden");
        card.classList.remove("menu-open");

        // ========== ACTION HANDLERS ==========
        if (action === "popup") {
            console.log("Opening popup…");
            openHistoryDetail(index);   // ⭐ POPUP FINALLY WORKS
            return;
        }

        if (action === "toggle") {
            content.classList.toggle("hidden");
            return;
        }

        if (action === "download") {
            // backend call (same as your existing logic)
            const payload = {
                username: USER_PROFILE.name || "User",
                calories: item.calories || 0,
                diet_plan: item.diet_plan || {},
                workout_plan: item.workout_plan || {},
                ai_advice: item.ai_advice || "",
                chat_history: item.chat_history || [],
            };
            callApi("/export-summary", payload);
            return;
        }

        if (action === "rename") {
            const newTitle = prompt("Enter new session name:", item.title);
            if (newTitle) {
                callApi("/history/rename", {
                    history_id: item._id,
                    title: newTitle
                }).then(() => renderHistory());
            }
            return;
        }

        if (action === "delete") {
            const ok = confirm("Delete this session permanently?");
            if (ok) {
                callApi("/history/delete", {
                    history_id: item._id
                }).then(() => renderHistory());
            }
            return;
        }
    });
});


            // 1) PURA CARD (header area) click → expand / collapse
            header.addEventListener("click", (e) => {
                // agar click menu button ya uske icon pe hua, to ignore
                if (e.target.closest(".history-menu-btn")) return;
                content.classList.toggle("hidden");
            });
            // 2) MENU BUTTON → context menu open / close
menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 🔹 pehle sab menus band karo + sab cards se 'menu-open' hatao
    document.querySelectorAll(".history-menu-panel").forEach(p => {
        p.classList.add("hidden");
    });
    document.querySelectorAll(".history-item").forEach(cardEl => {
        cardEl.classList.remove("menu-open");
    });

    // 🔹 agar yeh panel abhi hidden tha → ab open karo + is card ko top pe lao
    const willOpen = menuPanel.classList.contains("hidden");
    if (willOpen) {
        menuPanel.classList.remove("hidden");
        card.classList.add("menu-open");     // ⬅️ is card ko upar le aaya
    } else {
        // Already open hai → close karo
        menuPanel.classList.add("hidden");
        card.classList.remove("menu-open");
    }
});




            container.appendChild(card);
        });

        // 4) GLOBAL CLICK → sab context menu band
        document.addEventListener("click", (ev) => {
          
    // ⭐ if clicking inside menu item → do NOT close menu
    if (ev.target.closest(".history-menu-item")) {
        return;  // allow item to work normally
    }
    if (!ev.target.closest(".history-menu-panel") &&
        !ev.target.closest(".history-menu-btn")) {

        document
          .querySelectorAll(".history-menu-panel")
          .forEach(panel => panel.classList.add("hidden"));

        document
          .querySelectorAll(".history-item")
          .forEach(cardEl => cardEl.classList.remove("menu-open"));
    }
});


    } catch (e) {
        console.error("History Render Error", e);
        container.innerHTML = "<p style='color:#fca5a5;'>Failed to load history.</p>";
    }
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

// ================== WEEKLY CALORIE CHART (PROFESSIONAL FIX) ================== //
async function updateChart() {
    const ctx = document.getElementById("calorieChart");
    if (!ctx) return;

    // 🔥 FIX 1: Infinite Expand rokne ke liye Parent Height fix karo
    ctx.parentElement.style.height = "320px"; 

    let chartData = [0, 0, 0, 0, 0, 0, 0];
    const token = localStorage.getItem("authToken");

    if (token) {
        try {
            console.log("📊 Fetching fresh chart data...");
            // 🔥 FIX 2: '?t=' lagaya taaki browser cache na kare (Always Fresh Data)
            const res = await fetch(`${BASE_URL}/history/weekly?t=${Date.now()}`, {
                method: "GET",
                headers: { "Authorization": "Bearer " + token }
            });
            const data = await res.json();
            
            if (data.weekly_calories && Array.isArray(data.weekly_calories)) {
                // Negative values ya errors ko 0 kar do
                chartData = data.weekly_calories.map(v => (v >= 0 ? v : 0));
                console.log("✅ New Chart Data:", chartData);
            }
        } catch (err) {
            console.error("Chart Fetch Error:", err);
        }
    }

    // 🔥 FIX 3: Agar Chart pehle se hai, to sirf DATA update karo (Destroy mat karo)
    if (calorieChart instanceof Chart) {
        calorieChart.data.datasets[0].data = chartData;
        calorieChart.update(); // Smooth transition
    } else {
        // Sirf pehli baar Naya Chart banao
        calorieChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [{
                    label: "Calories",
                    data: chartData,
                    borderWidth: 3,
                    borderColor: "#6366f1",
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    pointBackgroundColor: "#818cf8",
                    pointRadius: 4,
                    tension: 0.4, // Smooth curve
                    fill: true
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // 🔥 Zaroori hai infinite loop rokne ke liye
                plugins: {
                    legend: { labels: { color: "#cbd5e1" } }
                },
                scales: {
                    x: { 
                        ticks: { color: "#94a3b8" }, 
                        grid: { color: "rgba(148,163,184,0.05)" } 
                    },
                    y: { 
                        ticks: { color: "#94a3b8" }, 
                        grid: { color: "rgba(148,163,184,0.05)" },
                        beginAtZero: true
                    }
                }
            }
        });
    }
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

// ================== SAVE SUMMARY (NO REFRESH + HISTORY UPDATE) ================== //
if (btnSaveSummary) {
  btnSaveSummary.addEventListener("click", async (e) => {
    // 🛑 1. STOP PAGE RELOAD
    e.preventDefault(); 
    e.stopPropagation();

    const originalText = btnSaveSummary.innerHTML;
    btnSaveSummary.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    btnSaveSummary.disabled = true;

    try {
        const payload = buildSummaryPayload();
        
        // 2. Call Backend
        const res = await callApi("/export-summary", payload);

        if (res && res.success) {
            showToast("Summary saved successfully!", "success");
            
            // 3. 🔥 UPDATE HISTORY LIST IMMEDIATELY (No Refresh)
            await renderHistory(); 
            
            // Optional: Open PDF
            //if(res.pdf_url) window.open(res.pdf_url, "_blank");
        } else {
            showToast("Failed to save summary.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error saving summary.", "error");
    } finally {
        btnSaveSummary.innerHTML = originalText;
        btnSaveSummary.disabled = false;
    }
  });
}



// ========== DOWNLOAD PDF ========== //
const btnDownloadPDF = document.getElementById("btnDownloadPDF");

if (btnDownloadPDF) {
  btnDownloadPDF.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ Extra safety

    const payload = buildSummaryPayload();
    const res = await callApi("/export-summary", payload);

    if (res && res.pdf_url) {
      window.open(res.pdf_url, "_blank");  // Current tab same hi rahega
    } else {
      showToast("Failed to generate PDF.", "error");
    }
  });
}


// ================== ON PAGE LOAD ================== //

// ================== ON PAGE LOAD (CRITICAL FIX) ================== //
window.addEventListener("load", () => {
    console.log("🚀 Page Loaded");

    // 1. Static State Restore (Optional)
    if (typeof restoreState === 'function') {
        restoreState();
    }

    // 2. CHECK: Kya hum Dashboard par hain?
    // Hum check karenge ki 'logoutBtn' page par hai ya nahi.
    // Agar logout button hai, iska matlab hum andar login hain.
    const isDashboard = document.getElementById("logoutBtn") || document.getElementById("dashboard");

    if (isDashboard) {
        // 🔥 Sirf Dashboard par hi Data Fetch karo
        console.log("✅ Dashboard detected. Initializing Data...");
        
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchUserProfileFromDB(); // Profile + Progress
            
            // ❌ OLD (BUG): updateChart(); // Dashboard par chart nahi chahiye
            // ❌ Yahi line chart ko infinite expand karwa rahi thi
        } else {
            // Agar token nahi hai par dashboard khul gaya hai, to login pe bhejo
            window.location.href = "index.html";
        }

        // Static UI Updates
        const chartCanvas = document.getElementById("calorieChart");

        if (chartCanvas) {
          console.log("📊 History Page detected — Loading chart...");
          updateChart();
        }
        // ⭐ Load history folders on page load (ChatGPT-style session list)
        const historyList = document.getElementById("historyList");
        if (historyList) {
          console.log("📁 Loading History Sessions...");
          renderHistory();
        }


        const historyPage = document.getElementById("historyContainer");
        if (historyPage) {
          renderHistory();
        }

        if (typeof updateDashboardMetrics === 'function') updateDashboardMetrics();
        if (typeof setRandomMotivation === 'function') setRandomMotivation();
    } 
    else {
        console.log("ℹ️ Login Page detected. Skipping Dashboard Logic.");
    }

    // ================================
    // ⭐ NEW: HISTORY PAGE CHART FIX ⭐
    // ================================
    
    // Chart sirf tab load hoga jab chart element present ho (History Page)
    const chartCanvas = document.getElementById("calorieChart");

    if (chartCanvas) {
        console.log("📊 History Page detected — Loading chart...");
        updateChart();  // 🟩 SAFE — Chart only loads on history page
    }
});




function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    let start = 0;
    const step = Math.ceil(target / 40);

    const counter = setInterval(() => {
        start += step;
        if (start >= target) {
            start = target;
            clearInterval(counter);
        }
        el.textContent = start;
    }, 20);
}


/* =========================================
   1. TOAST NOTIFICATION SYSTEM (Smooth UI)
   ========================================= */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
  
  document.body.appendChild(toast);

  // Animation Start
  setTimeout(() => toast.classList.add("show"), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}



/* =========================================
   DYNAMIC MOTIVATION GENERATOR
   ========================================= */
const motivationalQuotes = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It’s your mind that you have to convince.",
  "Fitness is not about being better than someone else. It’s about being better than you were yesterday.",
  "Discipline is doing what needs to be done, even if you don't want to do it.",
  "Success starts with self-discipline.",
  "Don't stop when you're tired. Stop when you're done.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "Sweat is just fat crying.",
  "A one-hour workout is only 4% of your day. No excuses.",
  "Motivation starts the journey; discipline finishes it.",
"Your body is built by the choices you repeat, not the choices you make once.",
"Every healthy meal is a vote for the person you want to become.",
"Strong habits create strong bodies.",
"You don’t need to be extreme—just consistent.",
"A 1% improvement daily becomes an unrecognizable transformation.",
"Your future physique is hidden inside today’s decisions.",
"Small workouts beat big excuses every time.",
"Food can be your medicine or your slow poison—choose wisely.",
"Progress is silent; results make the noise.",
"The discipline you build in fitness strengthens every area of your life.",
"Your body hears everything your mind says—train both.",
"Don’t wait for energy; create energy by moving.",
"You won’t always feel like it—do it anyway.",
"Healthy choices compound like interest.",
"Eat for the body you want, not the mood you’re in.",
"A strong mind builds a strong routine; a strong routine builds a strong body.",
"Sweat is your investment in a better tomorrow.",
"Success in fitness is simple: start, don’t stop.",
"The best project you will ever work on is yourself."

];

function setRandomMotivation() {
  const el = document.getElementById("motivationText");
  if (!el) return;

  // Pick random quote
  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
  const quote = motivationalQuotes[randomIndex];

  // Set text with animation effect
  el.style.opacity = 0;
  setTimeout(() => {
    el.innerHTML = `"${quote}"`;
    el.style.opacity = 1;
  }, 300);
}


// ==========================================
// 1. UPDATED REGISTER FUNCTION (With Toast)
// ==========================================
async function handleRegister(event) {
  event.preventDefault(); // Page reload roko

  // Button ko disable karo taaki double click na ho
  const btn = event.target.querySelector("button[type='submit']");
  const originalText = btn.innerText;
  btn.innerText = "Registering...";
  btn.disabled = true;

  const user = {
    name: document.getElementById("reg_name").value.trim(),
    email: document.getElementById("reg_email").value.trim(),
    password: document.getElementById("reg_password").value,
    age: Number(document.getElementById("reg_age").value),
    gender: document.getElementById("reg_gender").value,
    height: Number(document.getElementById("reg_height").value),
    weight: Number(document.getElementById("reg_weight").value),
    goal: document.getElementById("reg_goal").value
  };

  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });

    const data = await res.json();

    if (!res.ok) {
      // ❌ Error Toast
      showToast(data.detail || "Registration failed", "error");
    } else {
      // ✅ Success Toast
      showToast("Account created! Redirecting to Login...", "success");
      
      // 2 second wait karke Login form par bhejo
      setTimeout(() => {
          switchToLogin();
          // Optional: Email field auto-fill kar do
          document.getElementById("login_email").value = user.email;
      }, 2000);
    }

  } catch (err) {
    console.error(err);
    showToast("Server connection failed!", "error");
  } finally {
    // Button wapas normal karo
    btn.innerText = originalText;
    btn.disabled = false;
  }
}


// ==========================================
// 🚀 FINAL FIXED: AUTH LOGIC & SCROLL
// ==========================================

// 1. Hero Button Scroll Helper (Global Scope me hona chahiye)
function scrollToAuth() {
    const section = document.getElementById("login-section");
    if (section) {
        section.scrollIntoView({ behavior: "smooth" });
    }
}

// 2. Buttons & Forms Logic (Jab page load ho jaye tab chalega)
document.addEventListener("DOMContentLoaded", () => {
    
    // --- Elements Select Karo ---
    const loginSection = document.getElementById("login-section");
    const registerSection = document.getElementById("register-section");
    
    const btnShowRegister = document.getElementById("btnShowRegister");
    const btnShowLogin = document.getElementById("btnShowLogin");

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    // --- Button Click: Switch Forms ---
    
    // "Create an account" click hone par
    if (btnShowRegister) {
        btnShowRegister.addEventListener("click", () => {
            loginSection.style.display = "none";
            registerSection.style.display = "block";
        });
    }

    // "Login" click hone par
    if (btnShowLogin) {
        btnShowLogin.addEventListener("click", () => {
            registerSection.style.display = "none";
            loginSection.style.display = "block";
        });
    }

    // --- Form Submit: Backend Call ---

    // Login Form Submit
    if (loginForm) {
        // Purana listener hatane ke liye (safety) cloning use kar sakte hain, 
        // par simple addEventListener kaafi hai agar script ek baar load ho.
        loginForm.addEventListener("submit", handleLogin);
    }

    // Register Form Submit
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }

    // --- Security Check (Dashboard ke liye) ---
    if (window.location.pathname.includes("dashboard.html")) {
        const token = localStorage.getItem("authToken");
        if (!token) {
            alert("🔒 Access Denied! Please login first.");
            window.location.href = "index.html";
        } else {
            // Agar login hai, to profile fetch karo
            if (typeof fetchUserProfileFromDB === "function") {
                fetchUserProfileFromDB();
            }
        }
    }
});

// ==========================================
// 🚀 FIXED LOGOUT LOGIC (Replace your bottom code with this)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const logoutBtn = document.getElementById("logoutBtn");
    const modal = document.getElementById("logoutModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

    if (logoutBtn && modal) {
        // 1. Modal Open (Animation ke saath)
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault(); // Default link behavior roko
            modal.style.display = "flex";
            setTimeout(() => {
                modal.classList.add("active");
            }, 10);
        });

        // 2. Modal Close Function
        const closeModal = () => {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
        };

        // Cancel button dabane par
        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

        // Bahar click karne par band ho
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // 3. Confirm Logout (MAIN FIX IS HERE)
        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener("click", () => {
                console.log("Logging out & Clearing Data...");

                // 🔥 STEP A: Browser ki memory saaf karo (Sabse Zaroori)
                localStorage.removeItem("authToken");
                localStorage.removeItem("authUserId");
                localStorage.removeItem("ai_fitness_profile"); 
                localStorage.clear(); // Safety ke liye sab uda do
                sessionStorage.clear();

                // 🔥 STEP B: User ko 'Replace' karo taaki wo Back button se wapas na aa sake
                // Agar tumhara login page 'index.html' hai to ye line use karo:
                window.location.replace("index.html");
                
                // Agar tumhara login page 'login.html' naam se hai, to niche wali line uncomment karo:
                // window.location.replace("login.html");
            });
        }
    }
});

// ================== OPEN HISTORY MODAL ================== //
function openHistoryDetail(index) {
    console.log("OPENING POPUP WITH INDEX:", index);

    const data = _globalHistoryData[index];
    const modal = document.getElementById("historyModal");
    const content = document.getElementById("historyDetailContent");

    if (!data || !modal || !content) {
        console.error("Modal elements or data missing!");
        return;
    }

    // Fill modal content
    content.innerHTML = `
        <h2 style="margin-bottom:10px;">${data.title || "Session Details"}</h2>
        <p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p>
        <p><strong>Total Calories:</strong> ${data.calories || 0} kcal</p>

        <h3>Diet Plan</h3>
        ${renderDietPlanPretty(data.diet_plan)}

        <h3>Workout Plan</h3>
        ${renderWorkoutPlanPretty(data.workout_plan)}

        <h3>AI Advice</h3>
        <div>${renderMarkdown(data.ai_advice || "")}</div>
    `;

    // ⭐ REAL FIX HERE
    modal.classList.add("active");
    // ⭐ Reset state for re-open
modal.classList.add("show");
const box = document.querySelector(".history-modal-box");
if (box) box.scrollTop = 0;
}


function closeHistoryDetail() {
    const modal = document.getElementById("historyModal");

    // Remove visible class
    modal.classList.remove("show");

    // Fade-out animation handling
    setTimeout(() => {
        modal.classList.remove("active");  // IMPORTANT
    }, 200);
}

function renderChatHistoryPretty(chatArray) {
    if (!Array.isArray(chatArray)) return "<p>No chat history available.</p>";

    let html = `<div class="pretty-chat-history">`;

    chatArray.forEach(msg => {
        const role = msg.role === "assistant" ? "bot" : "user";
        const name = role === "bot" ? "🤖 AI Assistant" : "🧑 User";

        let content = renderMarkdown(msg.content || "");

        html += `
            <div class="chat-block ${role}">
                <div class="chat-role">${name}</div>
                <div class="chat-message">${content}</div>
            </div>
        `;
    });

    html += "</div>";
    return html;
}


