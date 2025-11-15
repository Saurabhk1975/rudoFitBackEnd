// src/routes/food.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const router = express.Router();
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");

// Groq / OpenAI client
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* ------------------ IST helper ------------------ */
/**
 * Return a Date object adjusted to IST (UTC+5:30)
 */
function getISTDate() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
  return new Date(now.getTime() + istOffsetMs);
}

/**
 * Format date parts into DD/MM/YYYY
 */
function formatDDMMYYYY(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/* ------------------ MULTER CONFIG ------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ------------------ JSON CLEANER ------------------ */
const extractJSON = (text) => {
  try {
    const match = (text || "").match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    return null;
  }
};

/* ------------------ AI HELPERS ------------------ */
const askAIForNutrition = async (text) => {
  // Best-effort: ask the Groq/LLM for minimal nutrition json
  const prompt = `You are a nutrition expert. Give minimum safe nutrition values for this food in JSON ONLY.
Example:
{"calories":200,"protein":10,"fat":5,"carbs":30,"sugar":2,"calcium":20}
Food: ${text}`;

  try {
    const r = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
    });
    // r.choices[0].message.content expected
    return extractJSON(r.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("askAIForNutrition error:", err?.message || err);
    return null;
  }
};

const askAIForLabel = async (text) => {
  const prompt = `Provide label + health tag in JSON only.
Example:
{"label":"Chicken Curry","healthTag":"good_to_have"}
Food: ${text}`;

  try {
    const r = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
    });
    return extractJSON(r.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("askAIForLabel error:", err?.message || err);
    return null;
  }
};

/* =========================================================
  1️⃣ ADD FOOD — robust, IST-based
  Flow:
   - determine IST today
   - ensure root doc exists (upsert)
   - ensure year exists
   - ensure month exists
   - ensure day exists
   - add numeric fields to day totals
   - push foodItem into day.foodItems
   - save()
========================================================= */
router.post("/addFood", upload.single("image"), async (req, res) => {
  const file = req.file;

  try {
    const { userId, foodData, customText } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // ---------- AI processing ----------
    let ai = null;
    let label = null;
    let name = "Food Item";
    let type = "unknown";

    if (foodData) {
      try {
        ai = JSON.parse(foodData);
      } catch (e) {
        return res.status(400).json({ error: "foodData must be valid JSON string" });
      }
      label = await askAIForLabel(foodData);
      name = label?.label || "Custom Food";
      type = "json";
    } else if (customText) {
      ai = await askAIForNutrition(customText);
      label = await askAIForLabel(customText);
      name = customText;
      type = "text";
    } else if (file) {
      ai = await askAIForNutrition("Food image uploaded");
      label = await askAIForLabel("Food from image");
      name = "Image Food";
      type = "image";
    } else {
      return res.status(400).json({ error: "Provide foodData (JSON), customText or an image" });
    }

    if (!ai) return res.status(400).json({ error: "AI returned invalid nutrition JSON" });
    if (!label) label = { label: name, healthTag: "unknown" }; // fallback

    // normalize numeric fields
    const numericFields = ["calories", "protein", "fat", "carbs", "sugar", "calcium"];
    numericFields.forEach((k) => {
      if (ai[k] === undefined || ai[k] === null || ai[k] === "") ai[k] = 0;
      ai[k] = Number(ai[k]) || 0;
    });

    const calories = ai.calories || 0;
    const isGood = (label.healthTag || "").toLowerCase() === "good_to_have";

    // ---------- IST date parts ----------
    const today = getISTDate();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    // Build foodItem (store createdAt as IST ISO string)
    const foodItem = {
      name,
      label: label.label || name,
      healthTag: label.healthTag || "unknown",
      ...ai,
      imageUrl: file ? file.path : null,
      sourceType: type,
      createdAt: getISTDate().toISOString(), // IST-based timestamp string
    };

    // ---------- Ensure root document exists (upsert) ----------
    let userFood = await FoodEntry.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, nutritionByDate: [] } },
      { upsert: true, new: true }
    );

    // ---------- Find or create year ----------
    let yearData = userFood.nutritionByDate.find((yr) => yr.year === y);
    if (!yearData) {
      yearData = { year: y, months: [] };
      userFood.nutritionByDate.push(yearData);
    }

    // ---------- Find or create month ----------
    let monthData = yearData.months.find((mm) => mm.month === m);
    if (!monthData) {
      monthData = { month: m, days: [] };
      yearData.months.push(monthData);
    }

    // ---------- Find or create day ----------
    let dayData = monthData.days.find((dd) => dd.day === d);
    if (!dayData) {
      dayData = {
        day: d,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        sugar: 0,
        calcium: 0,
        goodCalories: 0,
        badCalories: 0,
        foodItems: [],
      };
      monthData.days.push(dayData);
    }

    // ---------- Update totals ----------
    dayData.calories = (dayData.calories || 0) + (ai.calories || 0);
    dayData.protein = (dayData.protein || 0) + (ai.protein || 0);
    dayData.fat = (dayData.fat || 0) + (ai.fat || 0);
    dayData.carbs = (dayData.carbs || 0) + (ai.carbs || 0);
    dayData.sugar = (dayData.sugar || 0) + (ai.sugar || 0);
    dayData.calcium = (dayData.calcium || 0) + (ai.calcium || 0);

    if (isGood) dayData.goodCalories = (dayData.goodCalories || 0) + calories;
    else dayData.badCalories = (dayData.badCalories || 0) + calories;

    // ---------- Push food item ----------
    dayData.foodItems.push(foodItem);

    // ---------- Save ----------
    userFood.markModified("nutritionByDate");
    await userFood.save();

    return res.json({
      message: "Food added successfully",
      foodItem,
      today: `${d}/${m}/${y}`,
    });
  } catch (err) {
    console.error("Error in /addFood:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================================================
  2️⃣ GET ALL FOOD DATA
======================================================== */
router.get("/listFood/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const data = await FoodEntry.findOne({ userId });
    return res.json(data || { userId, nutritionByDate: [] });
  } catch (err) {
    console.error("Error in /listFood:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================================================
  3️⃣ GET CUSTOM DATE RANGE DATA (scalable)
     - startDate required "DD/MM/YYYY"
     - endDate optional. If missing => single day result.
     - Returns each day in the range (even empty)
======================================================== */
router.post("/getCustomDateData", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;
    if (!userId || !startDate)
      return res.status(400).json({ error: "userId and startDate required" });

    const food = await FoodEntry.findOne({ userId });
    if (!food)
      return res.json({ message: "No food data available", days: [] });

    // Parse start
    const [sDay, sMonth, sYear] = startDate.split("/").map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);

    // Parse end or set to start
    let end = start;
    if (endDate) {
      const [eDay, eMonth, eYear] = endDate.split("/").map(Number);
      end = new Date(eYear, eMonth - 1, eDay);
    }
    // Treat range inclusive until end of day in IST
    end.setHours(23, 59, 59, 999);

    // Create date pointers in local time (we consider dates as simple day boundaries)
    const range = [];
    const pointer = new Date(start);
    while (pointer <= end) {
      range.push({
        d: pointer.getDate(),
        m: pointer.getMonth() + 1,
        y: pointer.getFullYear(),
        dateString: `${pointer.getDate()}/${pointer.getMonth() + 1}/${pointer.getFullYear()}`,
      });
      pointer.setDate(pointer.getDate() + 1);
    }

    const daysResult = range.map((dt) => {
      const yearData = food.nutritionByDate.find((e) => e.year === dt.y);
      const monthData = yearData?.months.find((e) => e.month === dt.m);
      const dayData = monthData?.days.find((e) => e.day === dt.d);

      const totals = {
        calories: dayData?.calories || 0,
        protein: dayData?.protein || 0,
        fat: dayData?.fat || 0,
        carbs: dayData?.carbs || 0,
        sugar: dayData?.sugar || 0,
        calcium: dayData?.calcium || 0,
      };

      return {
        date: dt.dateString,
        totals,
        message: dayData ? "Food eaten on this day" : "Not eaten anything on this day",
      };
    });

    if (daysResult.length === 1) {
      return res.json({ message: "Single day data", day: daysResult[0] });
    }

    return res.json({
      message: "Date range data fetched",
      from: startDate,
      to: endDate || startDate,
      daysCount: daysResult.length,
      days: daysResult,
    });
  } catch (err) {
    console.error("Error in /getCustomDateData:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================================================
  4️⃣ TODAY'S SUMMARY (Homepage) — using IST
======================================================== */
router.get("/dataHomepage/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const today = getISTDate();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    const food = await FoodEntry.findOne({ userId });
    if (!food) {
      return res.json({
        consumed: { calories: 0, protein: 0, fat: 0, carb: 0 },
        today: `${d}/${m}/${y}`,
        nutritionByDate: [],
      });
    }

    const yearData = food.nutritionByDate.find((e) => e.year === y);
    const monthData = yearData?.months.find((e) => e.month === m);
    const dayData = monthData?.days.find((e) => e.day === d);

    const consumed = {
      calories: dayData?.calories || 0,
      protein: dayData?.protein || 0,
      fat: dayData?.fat || 0,
      carb: dayData?.carbs || 0,
    };

    return res.json({
      consumed,
      today: `${d}/${m}/${y}`,
      nutritionByDate: food.nutritionByDate,
    });
  } catch (err) {
    console.error("Error in /dataHomepage:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================================================
  DASHBOARD - ALL IN ONE (today, weekly, monthly, best/worst, most eaten)
  Works even if profile is missing; targets will be empty in that case.
======================================================== */
router.get("/dashboard/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // load profile if exists
    const profile = await UserProfile.findOne({ userId });
    const food = await FoodEntry.findOne({ userId });

    const today = getISTDate();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    // Today summary
    let todayData = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    let todayItems = [];

    if (food) {
      const yData = food.nutritionByDate.find((e) => e.year === y);
      const mData = yData?.months.find((e) => e.month === m);
      const dData = mData?.days.find((e) => e.day === d);

      if (dData) {
        todayData = {
          calories: dData.calories || 0,
          protein: dData.protein || 0,
          fat: dData.fat || 0,
          carbs: dData.carbs || 0,
        };
        todayItems = dData.foodItems || [];
      }
    }

    // Weekly summary (last 7 days incl today)
    let weekly = [];
    if (food) {
      const base = new Date(today);
      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const dt = new Date(base);
        dt.setDate(base.getDate() - i);
        weekDates.push(dt);
      }
      weekDates.reverse().forEach((dt) => {
        const yy = dt.getFullYear();
        const mm = dt.getMonth() + 1;
        const dd = dt.getDate();
        const yData = food.nutritionByDate.find((e) => e.year === yy);
        const mData = yData?.months.find((e) => e.month === mm);
        const dData = mData?.days.find((e) => e.day === dd);
        weekly.push({
          date: `${dd}/${mm}/${yy}`,
          calories: dData?.calories || 0,
        });
      });
    }

    // Monthly summary (current month)
    let monthly = [];
    if (food) {
      const numDays = new Date(y, m, 0).getDate();
      const yData = food.nutritionByDate.find((e) => e.year === y);
      const mData = yData?.months.find((e) => e.month === m);
      for (let day = 1; day <= numDays; day++) {
        const dData = mData?.days.find((e) => e.day === day);
        monthly.push({
          date: `${day}/${m}/${y}`,
          calories: dData?.calories || 0,
        });
      }
    }

    // best / worst days
    let best = null,
      worst = null;
    if (food) {
      const allDays = [];
      food.nutritionByDate.forEach((yy) => {
        yy.months.forEach((mm) => {
          mm.days.forEach((dd) => {
            allDays.push({
              date: `${dd.day}/${mm.month}/${yy.year}`,
              calories: dd.calories || 0,
            });
          });
        });
      });
      if (allDays.length > 0) {
        best = allDays.reduce((a, b) => (a.calories >= b.calories ? a : b));
        worst = allDays.reduce((a, b) => (a.calories <= b.calories ? a : b));
      }
    }

    // most eaten foods
    let mostEatenFoods = [];
    if (food) {
      const counter = {};
      food.nutritionByDate.forEach((yy) => {
        yy.months.forEach((mm) => {
          mm.days.forEach((dd) => {
            dd.foodItems.forEach((it) => {
              const key = it.label || it.name || "Unknown";
              counter[key] = (counter[key] || 0) + 1;
            });
          });
        });
      });
      mostEatenFoods = Object.entries(counter)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    }

    return res.json({
      message: "Dashboard data loaded",
      data: {
        today: {
          date: `${d}/${m}/${y}`,
          target: profile
            ? {
                calories: profile.targetCalorie,
                protein: profile.targetProtein,
                fat: profile.targetFat,
                carb: profile.targetCarb,
              }
            : {},
          consumed: todayData,
          items: todayItems,
        },
        weekly,
        monthly,
        best,
        worst,
        mostEatenFoods,
      },
    });
  } catch (err) {
    console.error("Error in /dashboard:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================================================
  AI Nutrition Advisor
  - Works even if profile missing: we pass best-available info to AI
  - Response expected as pure JSON from LLM (we try to parse)
======================================================== */
router.post("/aiNutritionAdvisor", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // load profile if exists (optional)
    const profile = await UserProfile.findOne({ userId });
    const food = await FoodEntry.findOne({ userId });

    // IST today
    const today = getISTDate();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    // Today's consumption from food entries
    const yData = food?.nutritionByDate.find((e) => e.year === y);
    const mData = yData?.months.find((e) => e.month === m);
    const dData = mData?.days.find((e) => e.day === d);

    const consumed = {
      calories: dData?.calories || 0,
      protein: dData?.protein || 0,
      fat: dData?.fat || 0,
      carbs: dData?.carbs || 0,
      sugar: dData?.sugar || 0,
      calcium: dData?.calcium || 0,
    };

    // If profile missing, create a fallback target object (zeros)
    const target = profile
      ? {
          calories: profile.targetCalorie || 0,
          protein: profile.targetProtein || 0,
          fat: profile.targetFat || 0,
          carb: profile.targetCarb || 0,
        }
      : { calories: 0, protein: 0, fat: 0, carb: 0 };

    // Build AI prompt — instruct to return JSON only
    const prompt = `
You are a helpful nutrition assistant. Respond ONLY with valid JSON (no extra text).
User basic info:
${profile ? `Age: ${profile.age}, Gender: ${profile.gender}, Goal: ${profile.goal}` : "No profile available."}

Targets:
${JSON.stringify(target)}

Today's consumption:
${JSON.stringify(consumed)}

Return JSON object with keys:
- deficiencies: array of short strings (e.g. "protein low")
- recommendFoods: array of foods to eat to cover deficiencies
- avoidFoods: array of foods to avoid
- supplements: array of supplement names if recommended
- summary: short single-line summary

Example:
{"deficiencies":["protein low"],"recommendFoods":["eggs","paneer"],"avoidFoods":["sugar"],"supplements":["Omega 3"],"summary":"Short text"}
`;

    // Call the responses endpoint
    let aiOutputRaw;
    try {
      const aiResp = await client.responses.create({
        model: "openai/gpt-oss-20b",
        input: prompt,
      });
      // responses.create returns .output_text property in our earlier examples
      aiOutputRaw = aiResp.output_text || JSON.stringify(aiResp);
    } catch (e) {
      console.error("AI call failed:", e);
      return res.status(500).json({ error: "AI service error" });
    }

    let advice;
    try {
      advice = JSON.parse(aiOutputRaw);
    } catch (e) {
      // If not valid JSON, return raw plus error note
      advice = { error: "AI returned non-JSON", raw: aiOutputRaw };
    }

    return res.json({
      message: "AI Nutrition Advice",
      date: `${d}/${m}/${y}`,
      consumed,
      target,
      advice,
    });
  } catch (err) {
    console.error("Error in /aiNutritionAdvisor:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
