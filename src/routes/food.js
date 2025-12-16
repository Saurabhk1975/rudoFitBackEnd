const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const router = express.Router();

const FoodEntry = require("../models/FoodEntry");

const upload = multer({ dest: "uploads/" });

function getISTDate() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const clean = (v) => (isNaN(Number(v)) ? 0 : Number(v));


const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function askAIForNutrition(text) {
  const prompt = `
Return ONLY JSON:
{"calories":number,"protein":number,"fat":number,"carbs":number,"sugar":number,"calcium":number}
Food: ${text}
`;
  const r = await client.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(r.choices[0].message.content);
}

async function askAIForLabel(text) {
  const prompt = `
Return ONLY JSON:
{"label":"Food name","healthTag":"good_to_have|bad_to_have|average"}
Food: ${text}
`;
  const r = await client.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(r.choices[0].message.content);
}


router.post("/addFood", upload.single("image"), async (req, res) => {
  try {
    const { userId, foodData, customText } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    let nutrition, label, name, sourceType;

    /* ---------- JSON INPUT ---------- */
    if (foodData) {
      const data = typeof foodData === "string" ? JSON.parse(foodData) : foodData;

      nutrition = {
        calories: clean(data.calories),
        protein: clean(data.protein),
        fat: clean(data.fat),
        carbs: clean(data.carbs),
        sugar: clean(data.sugar),
        calcium: clean(data.calcium),
      };

      name = data.name || "Custom Food";
      label = {
        label: name,
        healthTag: data.healthTag || "average",
      };
      sourceType = "json";
    }

    /* ---------- TEXT INPUT ---------- */
    else if (customText) {
      nutrition = await askAIForNutrition(customText);
      label = await askAIForLabel(customText);
      name = customText;
      sourceType = "text";
    }

    /* ---------- IMAGE INPUT ---------- */
    else if (req.file) {
      nutrition = await askAIForNutrition("Food image");
      label = await askAIForLabel("Food image");
      name = label.label;
      sourceType = "image";
    } else {
      return res.status(400).json({ error: "No food input provided" });
    }

    const now = getISTDate();
    const date = toISODate(now);

    const foodItem = {
      name,
      label: label.label,
      healthTag: label.healthTag,
      ...nutrition,
      imageUrl: req.file?.path || null,
      sourceType,
      createdAt: now,
    };

    /* ---------- CALORIE BUCKET LOGIC ---------- */
    const inc = {
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      sugar: nutrition.sugar,
      calcium: nutrition.calcium,
      goodCalories: 0,
      badCalories: 0,
      avgCalories: 0,
    };

    if (label.healthTag === "good_to_have") inc.goodCalories = nutrition.calories;
    else if (label.healthTag === "bad_to_have") inc.badCalories = nutrition.calories;
    else inc.avgCalories = nutrition.calories;

    /* ---------- ATOMIC UPSERT ---------- */
    await FoodEntry.updateOne(
      { userId, date },
      {
        $setOnInsert: {
          userId,
          date,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        },
        $inc: {
          "totals.calories": inc.calories,
          "totals.protein": inc.protein,
          "totals.fat": inc.fat,
          "totals.carbs": inc.carbs,
          "totals.sugar": inc.sugar,
          "totals.calcium": inc.calcium,
          "totals.goodCalories": inc.goodCalories,
          "totals.badCalories": inc.badCalories,
          "totals.avgCalories": inc.avgCalories,
        },
        $push: { foodItems: foodItem },
      },
      { upsert: true }
    );

    res.json({ message: "Food added successfully", date });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// router.get("/today/:userId", async (req, res) => {
//   const date = toISODate(getISTDate());
//   const doc = await FoodEntry.findOne({ userId: req.params.userId, date });

//   res.json({
//     date,
//     totals: doc?.totals || {},
//     items: doc?.foodItems || [],
//   });
// });

router.get("/today/:userId", async (req, res) => {
  try {
    const today = toISODate(getISTDate());
    const { userId } = req.params;

    const doc = await FoodEntry.findOne({ userId, date: today }).lean();

    if (doc) {
      return res.json({
        date: today,
        totals: doc.totals,
        items: doc.foodItems || [],
        message: "Food eaten today",
      });
    }

    // No entry today → return zero
    res.json({
      date: today,
      totals: {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        sugar: 0,
        calcium: 0,
        goodCalories: 0,
        badCalories: 0,
        avgCalories: 0,
      },
      items: [],
      message: "No food eaten today",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Weekly
// router.get("/weekly/:userId", async (req, res) => {
//   try {
//     const data = await FoodEntry.find({ userId: req.params.userId })
//       .sort({ createdAt: -1 })
//       .limit(7)
//       .select("date totals");

//     res.json({
//       count: data.length,
//       days: data.reverse(),
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// Weekly (last 7 days, IST-safe, zero-filled)
router.get("/weekly/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = getISTDate();

    // Build last 7 days (IST calendar days)
    const daysMeta = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      daysMeta.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        iso: toISODate(d),
      });
    }

    // Fetch matching DB entries
    const docs = await FoodEntry.find({
      userId,
      $or: daysMeta.map(d => ({
        year: d.year,
        month: d.month,
        day: d.day,
      })),
    }).lean();

    // Map by Y-M-D key
    const map = {};
    docs.forEach(d => {
      map[`${d.year}-${d.month}-${d.day}`] = d;
    });

    // Build response
    const days = daysMeta.map(d => {
      const key = `${d.year}-${d.month}-${d.day}`;

      if (map[key]) {
        return {
          date: d.iso,
          totals: map[key].totals,
          items: map[key].foodItems || [],
          message: "Food eaten",
        };
      }

      return {
        date: d.iso,
        totals: {
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          sugar: 0,
          calcium: 0,
          goodCalories: 0,
          badCalories: 0,
          avgCalories: 0,
        },
        items: [],
        message: "No food eaten",
      };
    });

    res.json({
      range: "last_7_days",
      daysCount: days.length,
      days,
    });
  } catch (err) {
    console.error("Weekly error:", err);
    res.status(500).json({ error: err.message });
  }
});



// Monthly
// router.get("/monthly/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const now = getISTDate();

//     const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-01`;
//     const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-31`;

//     const data = await FoodEntry.find({
//       userId,
//       date: { $gte: start, $lte: end },
//     }).sort({ date: 1 });

//     res.json({
//       count: data.length,
//       days: data,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// Monthly (year + month aware, zero-filled, IST-safe)
router.get("/monthly/:userId/:year/:month", async (req, res) => {
  try {
    const { userId, year, month } = req.params;

    const y = Number(year);
    const m = Number(month); // 1–12

    if (m < 1 || m > 12) {
      return res.status(400).json({ error: "Invalid month" });
    }

    const todayIST = getISTDate();
    const isCurrentMonth =
      y === todayIST.getFullYear() && m === todayIST.getMonth() + 1;

    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const endDay = isCurrentMonth ? todayIST.getDate() : lastDayOfMonth;

    // Fetch existing data
    const docs = await FoodEntry.find({
      userId,
      year: y,
      month: m,
    }).lean();

    // Build map by DAY (not date string)
    const map = {};
    docs.forEach(d => {
      map[d.day] = d;
    });

    const days = [];

    for (let day = 1; day <= endDay; day++) {
      if (map[day]) {
        days.push({
          date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          totals: map[day].totals,
          items: map[day].foodItems || [],
          message: "Food eaten",
        });
      } else {
        days.push({
          date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            sugar: 0,
            calcium: 0,
            goodCalories: 0,
            badCalories: 0,
            avgCalories: 0,
          },
          items: [],
          message: "No food eaten",
        });
      }
    }

    res.json({
      year: y,
      month: m,
      daysCount: days.length,
      days,
    });
  } catch (err) {
    console.error("Monthly error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/range", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: "userId, startDate, endDate required" });
    }

    // 1️⃣ Fetch existing data
    const docs = await FoodEntry.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    // 2️⃣ Build map: date -> doc
    const map = {};
    docs.forEach(d => {
      map[d.date] = d;
    });

    // 3️⃣ Generate full date range
    const results = [];
    let cursor = new Date(startDate);
    const end = new Date(endDate);

    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}`;

      if (map[iso]) {
        // existing day
        results.push({
          date: iso,
          totals: map[iso].totals,
          items: map[iso].foodItems || [],
          message: "Food eaten",
        });
      } else {
        // missing day → zero
        results.push({
          date: iso,
          totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            sugar: 0,
            calcium: 0,
            goodCalories: 0,
            badCalories: 0,
            avgCalories: 0,
          },
          items: [],
          message: "No food eaten",
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({
      userId,
      from: startDate,
      to: endDate,
      daysCount: results.length,
      days: results,
    });

  } catch (err) {
    console.error("Range error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/recent/:userId", async (req, res) => {
  const items = await FoodEntry.aggregate([
    { $match: { userId: req.params.userId } },
    { $unwind: "$foodItems" },
    { $sort: { "foodItems.createdAt": -1 } },
    { $limit: 10 },
    { $replaceRoot: { newRoot: "$foodItems" } },
  ]);

  res.json({ recent: items });
});

// Yearly
router.get("/yearly/:userId/:year", async (req, res) => {
  try {
    const { userId, year } = req.params;

    const data = await FoodEntry.aggregate([
      {
        $match: {
          userId,
          year: Number(year),
        },
      },
      {
        $group: {
          _id: "$month",
          calories: { $sum: "$totals.calories" },
          protein: { $sum: "$totals.protein" },
          fat: { $sum: "$totals.fat" },
          carbs: { $sum: "$totals.carbs" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      year: Number(year),
      months: data.map((m) => ({
        month: m._id,
        calories: m.calories,
        protein: m.protein,
        fat: m.fat,
        carbs: m.carbs,
      })),
    });
  } catch (err) {
    console.error("Yearly error:", err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;















































// // src/routes/food.js
// const express = require("express");
// const multer = require("multer");
// const fs = require("fs");
// const router = express.Router();
// const FoodEntry = require("../models/FoodEntry");
// const UserProfile = require("../models/UserProfile");
// const OpenAI = require("openai");

// // Groq / OpenAI client
// const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1",
// });

// /* ------------------ IST helper ------------------ */
// /**
//  * Return a Date object adjusted to IST (UTC+5:30)
//  */
// function getISTDate() {
//   const now = new Date();
//   const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
//   return new Date(now.getTime() + istOffsetMs);
// }

// /**
//  * Format date parts into DD/MM/YYYY
//  */
// function formatDDMMYYYY(dateObj) {
//   const d = dateObj.getDate();
//   const m = dateObj.getMonth() + 1;
//   const y = dateObj.getFullYear();
//   return `${d}/${m}/${y}`;
// }

// /* ------------------ MULTER CONFIG ------------------ */
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = "uploads/";
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
// });
// const upload = multer({ storage });

// /* ------------------ JSON CLEANER ------------------ */
// const extractJSON = (text) => {
//   try {
//     const match = (text || "").match(/\{[\s\S]*\}/);
//     return match ? JSON.parse(match[0]) : null;
//   } catch (e) {
//     return null;
//   }
// };

// /* ------------------ AI HELPERS ------------------ */
// const askAIForNutrition = async (text) => {
//   // Best-effort: ask the Groq/LLM for minimal nutrition json
//   const prompt = `You are a certified nutritionist and food science expert.  
// Your task is to extract accurate nutritional values for any Indian or international food item.

// Always follow these strict rules:

// 1. ALWAYS return valid JSON ONLY. No explanation, no sentences.
// 2. If quantity is not mentioned, assume the SMALLEST reasonable serving size used in Indian households:
//    - Dal/Sabzi: 1 small bowl (80 ml)
//    - Rice: 1 small katori (90 grams)
//    - Roti: 1 small roti (25 grams)
//    - Milk items: 100 ml
//    - Fried items: minimum standard piece size (50–75 grams)
//    - Meat/Chicken: 100 grams minimum
//    - Fruits: 1 small unit (Banana small, Apple small etc.)
// 3. Always use MINIMUM safe realistic nutrition values based on research (not high estimates).
// 4. If food is unclear or vague (e.g., "dal", "sabzi", "fruit"), choose the LOWEST nutritional variant:
//    - Dal → Masoor dal (lowest protein)
//    - Sabzi → Lauki (lowest calories)
//    - Fruit → Apple small (lowest calories)
// 5. If user mentions grams/ml explicitly, use EXACT value.
// 6. If food contains sugar, fried items, sweets — classify correctly in healthTag (good_to_have / bad_to_have).
// 7. Make sure JSON contains EXACTLY these keys:

// {
//   "label": "Readable name",
//   "healthTag": "good_to_have | bad_to_have",
//   "calories": number,
//   "protein": number,
//   "fat": number,
//   "carbs": number,
//   "sugar": number,
//   "calcium": number
// }

// Now process this food and return JSON ONLY:

// Example:
// {"calories":200,"protein":10,"fat":5,"carbs":30,"sugar":2,"calcium":20}
// Food: ${text}`;

//   try {
//     const r = await client.chat.completions.create({
//       model: "openai/gpt-oss-20b",
//       messages: [{ role: "user", content: prompt }],
//     });
//     // r.choices[0].message.content expected
//     return extractJSON(r.choices?.[0]?.message?.content);
//   } catch (err) {
//     console.error("askAIForNutrition error:", err?.message || err);
//     return null;
//   }
// };

// const askAIForLabel = async (text) => {
//   const prompt = `Provide label + health tag in JSON only.
// Example:
// {"label":"Chicken Curry","healthTag":"good_to_have"}
// Food: ${text}`;

//   try {
//     const r = await client.chat.completions.create({
//       model: "openai/gpt-oss-20b",
//       messages: [{ role: "user", content: prompt }],
//     });
//     return extractJSON(r.choices?.[0]?.message?.content);
//   } catch (err) {
//     console.error("askAIForLabel error:", err?.message || err);
//     return null;
//   }
// };

// /* =========================================================
//   1️⃣ ADD FOOD — robust, IST-based
//   Flow:
//    - determine IST today
//    - ensure root doc exists (upsert)
//    - ensure year exists
//    - ensure month exists
//    - ensure day exists
//    - add numeric fields to day totals
//    - push foodItem into day.foodItems
//    - save()
// ========================================================= */

// // router.post("/addFood", upload.single("image"), async (req, res) => {
// //   const file = req.file;

// //   try {
// //     const { userId, foodData, customText } = req.body;
// //     if (!userId) return res.status(400).json({ error: "userId required" });

// //     // ---------- AI / input handling ----------
// //     let ai = null;
// //     let label = null;
// //     let name = "Food Item";
// //     let sourceType = "unknown";

// //     if (foodData) {
// //       // foodData expected as JSON string or JSON object
// //       if (typeof foodData === "string") {
// //         try {
// //           ai = JSON.parse(foodData);
// //         } catch (e) {
// //           return res.status(400).json({ error: "foodData must be valid JSON" });
// //         }
// //       } else {
// //         ai = foodData;
// //       }
// //       // try to get label from AI; if AI fails we'll fallback
// //       label = await askAIForLabel(typeof foodData === "string" ? foodData : JSON.stringify(foodData));
// //       name = label?.label || "Custom Food";
// //       sourceType = "json";
// //     } else if (customText) {
// //       ai = await askAIForNutrition(customText);
// //       label = await askAIForLabel(customText);
// //       name = customText;
// //       sourceType = "text";
// //     } else if (file) {
// //       ai = await askAIForNutrition("Food image uploaded: " + (file.originalname || ""));
// //       label = await askAIForLabel("Food image");
// //       name = label?.label || "Image Food";
// //       sourceType = "image";
// //     } else {
// //       return res.status(400).json({ error: "Provide foodData (JSON), customText, or an image" });
// //     }

// //     if (!ai) {
// //       return res.status(400).json({ error: "AI failed to provide nutrition data" });
// //     }

// //     // ---------- Normalize numeric fields (safe coercion) ----------
// //     const numericKeys = ["calories", "protein", "fat", "carbs", "sugar", "calcium"];
// //     numericKeys.forEach((k) => {
// //       // handle cases like { $numberInt: "10" } by converting to primitive if needed
// //       const v = ai[k];
// //       if (v === undefined || v === null || v === "") {
// //         ai[k] = 0;
// //       } else if (typeof v === "object" && (v.$numberInt || v.$numberDouble || v.$numberLong)) {
// //         // handle some Mongo exported forms
// //         ai[k] = Number(v.$numberInt || v.$numberDouble || v.$numberLong) || 0;
// //       } else {
// //         ai[k] = Number(v) || 0;
// //       }
// //     });

// //     const calories = ai.calories || 0;
// //     const isGood = (label?.healthTag || "").toString().toLowerCase() === "good_to_have";

// //     // ---------- IST date (use IST everywhere) ----------
// //     const nowIST = getISTDate();
// //     const year = nowIST.getFullYear();
// //     const month = nowIST.getMonth() + 1;
// //     const day = nowIST.getDate();

// //     // Build the foodItem to push (createdAt stored as IST ISO string)
// //     const foodItem = {
// //       name: name,
// //       label: label?.label || name,
// //       healthTag: label?.healthTag || "unknown",
// //       calories: ai.calories || 0,
// //       protein: ai.protein || 0,
// //       fat: ai.fat || 0,
// //       carbs: ai.carbs || 0,
// //       sugar: ai.sugar || 0,
// //       calcium: ai.calcium || 0,
// //       imageUrl: file ? file.path : null,
// //       sourceType,
// //       createdAt: getISTDate().toISOString(),
// //     };

// //     // ---------- Fetch or create root document ----------
// //     // ensure document exists (upsert)
// //     let userFood = await FoodEntry.findOneAndUpdate(
// //       { userId },
// //       { $setOnInsert: { userId, nutritionByDate: [] } },
// //       { upsert: true, new: true }
// //     );

// //     // ---------- Ensure year exists ----------
// //     let yearDoc = userFood.nutritionByDate.find((y) => y.year === year);
// //     if (!yearDoc) {
// //       yearDoc = { year: year, months: [] };
// //       userFood.nutritionByDate.push(yearDoc);
// //     }

// //     // ---------- Ensure month exists ----------
// //     let monthDoc = yearDoc.months.find((mDoc) => mDoc.month === month);
// //     if (!monthDoc) {
// //       monthDoc = { month: month, days: [] };
// //       yearDoc.months.push(monthDoc);
// //     }

// //     // ---------- Ensure day exists ----------
// //     let dayDoc = monthDoc.days.find((dDoc) => dDoc.day === day);
// //     if (!dayDoc) {
// //       dayDoc = {
// //         day: day,
// //         calories: 0,
// //         protein: 0,
// //         fat: 0,
// //         carbs: 0,
// //         sugar: 0,
// //         calcium: 0,
// //         goodCalories: 0,
// //         badCalories: 0,
// //         foodItems: [],
// //       };
// //       monthDoc.days.push(dayDoc);
// //     }

// //     // ---------- Update totals (add new values to current totals) ----------
// //     dayDoc.calories = (Number(dayDoc.calories) || 0) + (Number(ai.calories) || 0);
// //     dayDoc.protein = (Number(dayDoc.protein) || 0) + (Number(ai.protein) || 0);
// //     dayDoc.fat = (Number(dayDoc.fat) || 0) + (Number(ai.fat) || 0);
// //     dayDoc.carbs = (Number(dayDoc.carbs) || 0) + (Number(ai.carbs) || 0);
// //     dayDoc.sugar = (Number(dayDoc.sugar) || 0) + (Number(ai.sugar) || 0);
// //     dayDoc.calcium = (Number(dayDoc.calcium) || 0) + (Number(ai.calcium) || 0);

// //     if (isGood) {
// //       dayDoc.goodCalories = (Number(dayDoc.goodCalories) || 0) + calories;
// //     } else {
// //       dayDoc.badCalories = (Number(dayDoc.badCalories) || 0) + calories;
// //     }

// //     // ---------- Push the foodItem into day's foodItems ----------
// //     dayDoc.foodItems.push(foodItem);

// //     // ---------- Persist to DB ----------
// //     userFood.markModified("nutritionByDate");
// //     await userFood.save();

// //     // Return updated day and whole nutritionByDate for verification
// //     const updatedDay = monthDoc.days.find((dd) => dd.day === day);
// //     return res.json({
// //       message: "Food added and totals updated (IST applied)",
// //       today: `${day}/${month}/${year}`,
// //       updatedDay,
// //       nutritionByDate: userFood.nutritionByDate,
// //     });
// //   } catch (err) {
// //     console.error("Error in /addFood:", err);
// //     return res.status(500).json({ error: err.message || "Server error" });
// //   }
// // });
// router.post("/addFood", upload.single("image"), async (req, res) => {
//   const file = req.file;

//   try {
//     const { userId, foodData, customText } = req.body;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     let ai = null;
//     let label = null;
//     let name = "Food Item";
//     let sourceType = "unknown";

//     /* =====================================================
//        CASE 1 — JSON FOOD INPUT (NO AI)
//     ===================================================== */
//     if (foodData) {
//       let data = null;

//       // parse JSON safely
//       if (typeof foodData === "string") {
//         try {
//           data = JSON.parse(foodData);
//         } catch (err) {
//           return res.status(400).json({ error: "Invalid JSON in foodData" });
//         }
//       } else {
//         data = foodData;
//       }

//       // take ONLY required fields
//       ai = {
//         calories: Number(data.calories) || 0,
//         protein: Number(data.protein) || 0,
//         fat: Number(data.fat) || 0,
//         carbs: Number(data.carbs) || 0,
//         sugar: Number(data.sugar) || 0,
//         calcium: Number(data.calcium) || 0,
//       };

//       name = data.name || "Custom Food";
//       label = { label: name, healthTag: "good_to_have" }; // simple classification
//       sourceType = "json";
//     }

//     /* =====================================================
//        CASE 2 — CUSTOM TEXT → USE AI
//     ===================================================== */
//     else if (customText) {
//       ai = await askAIForNutrition(customText);
//       label = await askAIForLabel(customText);
//       name = customText;
//       sourceType = "text";

//       if (!ai) return res.status(400).json({ error: "AI failed to return nutrition" });
//     }

//     /* =====================================================
//        CASE 3 — IMAGE → USE AI
//     ===================================================== */
//     else if (file) {
//       ai = await askAIForNutrition("Food image uploaded: " + file.originalname);
//       label = await askAIForLabel("Food image");
//       name = label?.label || "Image Food";
//       sourceType = "image";

//       if (!ai) return res.status(400).json({ error: "AI failed to return nutrition" });
//     }

//     else {
//       return res.status(400).json({ error: "Provide foodData, customText or image" });
//     }

//     /* =====================================================
//        SANITIZE NUMERIC VALUES (SAFE)
//     ===================================================== */
//     const clean = (v) => (isNaN(Number(v)) ? 0 : Number(v));

//     ai.calories = clean(ai.calories);
//     ai.protein = clean(ai.protein);
//     ai.fat = clean(ai.fat);
//     ai.carbs = clean(ai.carbs);
//     ai.sugar = clean(ai.sugar);
//     ai.calcium = clean(ai.calcium);

//     const calories = ai.calories;
//     const isGood = (label?.healthTag || "").toLowerCase() === "good_to_have";

//     /* =====================================================
//        GET TODAY IN IST
//     ===================================================== */
//     const nowIST = getISTDate();
//     const year = nowIST.getFullYear();
//     const month = nowIST.getMonth() + 1;
//     const day = nowIST.getDate();

//     /* =====================================================
//        BUILD FOOD ITEM
//     ===================================================== */
//     const foodItem = {
//       name,
//       label: label?.label || name,
//       healthTag: label?.healthTag || "unknown",
//       calories: ai.calories,
//       protein: ai.protein,
//       fat: ai.fat,
//       carbs: ai.carbs,
//       sugar: ai.sugar,
//       calcium: ai.calcium,
//       imageUrl: file ? file.path : null,
//       sourceType,
//       createdAt: nowIST.toISOString(),
//     };

//     /* =====================================================
//        DB OPERATIONS
//     ===================================================== */

//     // ensure root doc exists
//     let userFood = await FoodEntry.findOneAndUpdate(
//       { userId },
//       { $setOnInsert: { userId, nutritionByDate: [] } },
//       { upsert: true, new: true }
//     );

//     // ensure year
//     let yearDoc = userFood.nutritionByDate.find((y) => y.year === year);
//     if (!yearDoc) {
//       yearDoc = { year, months: [] };
//       userFood.nutritionByDate.push(yearDoc);
//     }

//     // ensure month
//     let monthDoc = yearDoc.months.find((m) => m.month === month);
//     if (!monthDoc) {
//       monthDoc = { month, days: [] };
//       yearDoc.months.push(monthDoc);
//     }

//     // ensure day
//     let dayDoc = monthDoc.days.find((d) => d.day === day);
//     if (!dayDoc) {
//       dayDoc = {
//         day,
//         calories: 0,
//         protein: 0,
//         fat: 0,
//         carbs: 0,
//         sugar: 0,
//         calcium: 0,
//         goodCalories: 0,
//         badCalories: 0,
//         foodItems: [],
//       };
//       monthDoc.days.push(dayDoc);
//     }

//     /* =====================================================
//        UPDATE TOTALS
//     ===================================================== */
//     dayDoc.calories += ai.calories;
//     dayDoc.protein += ai.protein;
//     dayDoc.fat += ai.fat;
//     dayDoc.carbs += ai.carbs;
//     dayDoc.sugar += ai.sugar;
//     dayDoc.calcium += ai.calcium;

//     if (isGood) dayDoc.goodCalories += calories;
//     else dayDoc.badCalories += calories;

//     // push food item
//     dayDoc.foodItems.push(foodItem);

//     userFood.markModified("nutritionByDate");
//     await userFood.save();

//     return res.json({
//       message: "Food added successfully",
//       today: `${day}/${month}/${year}`,
//       updatedDay: dayDoc,
//       nutritionByDate: userFood.nutritionByDate,
//     });

//   } catch (err) {
//     console.error("Error in /addFood:", err);
//     return res.status(500).json({ error: err.message });
//   }
// });


// /* =========================================================
//   1️⃣ ADD FOOD — FIXED VERSION
// ========================================================= */
// router.post("/addFood", upload.single("image"), async (req, res) => {
//   const file = req.file;

//   try {
//     const { userId, foodData, customText } = req.body;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     let ai = null;
//     let label = null;
//     let name = "Food Item";
//     let sourceType = "unknown";

//     /* ------------ Parse Incoming JSON Safely ------------ */
//     if (foodData) {
//       try {
//         ai = typeof foodData === "string" ? JSON.parse(foodData) : foodData;
//       } catch {
//         return res.status(400).json({ error: "Invalid JSON in foodData" });
//       }
//       label = await askAIForLabel(foodData);
//       name = label?.label || "Custom Food";
//       sourceType = "json";
//     } 
//     else if (customText) {
//       ai = await askAIForNutrition(customText);
//       label = await askAIForLabel(customText);
//       name = customText;
//       sourceType = "text";
//     } 
//     else if (file) {
//       ai = await askAIForNutrition("Food image uploaded");
//       label = await askAIForLabel("Food image");
//       name = label?.label || "Image Food";
//       sourceType = "image";
//     } 
//     else {
//       return res.status(400).json({ error: "Provide foodData, customText or image" });
//     }

//     if (!ai) return res.status(400).json({ error: "AI returned invalid data" });

//     /* ------------ FIX: Sanitize & Convert Nutrition Values ------------ */
//     const clean = (val) => {
//       if (val === undefined || val === null) return 0;

//       if (typeof val === "object" && (val.$numberInt || val.$numberDouble))
//         return Number(val.$numberInt || val.$numberDouble || 0);

//       // remove all non-numeric characters
//       if (typeof val === "string") {
//         val = val.replace(/[^\d.-]/g, "");  // keep numbers, minus, decimal
//       }

//       let num = Number(val);
//       return isNaN(num) ? 0 : num;
//     };

//     ai.calories = clean(ai.calories);
//     ai.protein = clean(ai.protein);
//     ai.fat = clean(ai.fat);
//     ai.carbs = clean(ai.carbs);
//     ai.sugar = clean(ai.sugar);
//     ai.calcium = clean(ai.calcium);

//     const calories = ai.calories;
//     const isGood = (label?.healthTag || "").toLowerCase() === "good_to_have";

//     /* ------------ IST DATE ------------ */
//     const nowIST = getISTDate();
//     const year = nowIST.getFullYear();
//     const month = nowIST.getMonth() + 1;
//     const day = nowIST.getDate();

//     const foodItem = {
//       name,
//       label: label?.label || name,
//       healthTag: label?.healthTag || "unknown",
//       calories: ai.calories,
//       protein: ai.protein,
//       fat: ai.fat,
//       carbs: ai.carbs,
//       sugar: ai.sugar,
//       calcium: ai.calcium,
//       imageUrl: file ? file.path : null,
//       sourceType,
//       createdAt: getISTDate().toISOString(),
//     };

//     /* ------------ Load Root Document ------------ */
//     // Ensure root doc exists
// await FoodEntry.updateOne(
//   { userId },
//   { $setOnInsert: { userId, nutritionByDate: [] } },
//   { upsert: true }
// );

// // Always fetch fresh, hydrated doc
// let userFood = await FoodEntry.findOne({ userId });


//     /* ------------ Ensure Year ------------ */
//     let yearDoc = userFood.nutritionByDate.find((e) => e.year === year);
//     if (!yearDoc) {
//       yearDoc = { year, months: [] };
//       userFood.nutritionByDate.push(yearDoc);
//     }

//     /* ------------ Ensure Month ------------ */
//     let monthDoc = yearDoc.months.find((e) => e.month === month);
//     if (!monthDoc) {
//       monthDoc = { month, days: [] };
//       yearDoc.months.push(monthDoc);
//     }

//     /* ------------ Ensure Day ------------ */
//     let dayDoc = monthDoc.days.find((e) => e.day === day);
//     if (!dayDoc) {
//       dayDoc = {
//         day,
//         calories: 0,
//         protein: 0,
//         fat: 0,
//         carbs: 0,
//         sugar: 0,
//         calcium: 0,
//         goodCalories: 0,
//         badCalories: 0,
//         foodItems: [],
//       };
//       monthDoc.days.push(dayDoc);
//     }

//     /* ------------ Update Totals ------------ */
//     dayDoc.calories += ai.calories;
//     dayDoc.protein += ai.protein;
//     dayDoc.fat += ai.fat;
//     dayDoc.carbs += ai.carbs;
//     dayDoc.sugar += ai.sugar;
//     dayDoc.calcium += ai.calcium;

//     if (isGood) dayDoc.goodCalories += calories;
//     else dayDoc.badCalories += calories;

//     dayDoc.foodItems.push(foodItem);

//     userFood.markModified("nutritionByDate");
//     await userFood.save();

//     return res.json({
//       message: "Food added successfully",
//       today: `${day}/${month}/${year}`,
//       updatedDay: dayDoc,
//       nutritionByDate: userFood.nutritionByDate,
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: err.message });
//   }
// });




// /* =========================================================
//   ADD FOOD FROM JSON ONLY  
//   (No AI, No image, No custom text)
// ========================================================= */
// /* =========================================================
//    ADD FOOD USING JSON DATA (Same behaviour as /addFood)
// ========================================================= */
// router.post("/addJsonFood", async (req, res) => {
//   try {
//     const { userId, foodData } = req.body;
//     if (!userId) return res.status(400).json({ error: "userId is required" });
//     if (!foodData) return res.status(400).json({ error: "foodData is required" });

//     /* ---------- Clean Number Helper ---------- */
//     const clean = (v) => {
//       if (v === undefined || v === null) return 0;
//       if (typeof v === "string") v = v.replace(/[^\d.-]/g, "");
//       const num = Number(v);
//       return isNaN(num) ? 0 : num;
//     };

//     /* ---------- Extract Correct Fields ---------- */
//     const name = foodData.name || "Food Item";

//     const calories = clean(foodData.calories);
//     const protein = clean(foodData.protein_g);
//     const carbs = clean(foodData.carbs_g);
//     const fat = clean(foodData.fat_g);
//     const sugar = clean(foodData.sugar_g);
//     const calcium = clean(foodData.calcium_mg);

//     // Mark as goodCalories by default (you can apply your logic later)
//     const isGood = true;

//     /* ---------- IST DATE ---------- */
//     const now = getISTDate();
//     const year = now.getFullYear();
//     const month = now.getMonth() + 1;
//     const day = now.getDate();

//     const foodItem = {
//       name,
//       label: name,
//       healthTag: "good_to_have",
//       calories,
//       protein,
//       fat,
//       carbs,
//       sugar,
//       calcium,
//       imageUrl: null,
//       sourceType: "json",
//       createdAt: now.toISOString(),
//     };

//     /* ---------- Create root doc if missing ---------- */
//     await FoodEntry.updateOne(
//       { userId },
//       { $setOnInsert: { userId, nutritionByDate: [] } },
//       { upsert: true }
//     );

//     let userFood = await FoodEntry.findOne({ userId });

//     /* ---------- Ensure YEAR ---------- */
//     let yearDoc = userFood.nutritionByDate.find((y) => y.year === year);
//     if (!yearDoc) {
//       yearDoc = { year, months: [] };
//       userFood.nutritionByDate.push(yearDoc);
//     }

//     /* ---------- Ensure MONTH ---------- */
//     let monthDoc = yearDoc.months.find((m) => m.month === month);
//     if (!monthDoc) {
//       monthDoc = { month, days: [] };
//       yearDoc.months.push(monthDoc);
//     }

//     /* ---------- Ensure DAY ---------- */
//     let dayDoc = monthDoc.days.find((d) => d.day === day);
//     if (!dayDoc) {
//       dayDoc = {
//         day,
//         calories: 0,
//         protein: 0,
//         fat: 0,
//         carbs: 0,
//         sugar: 0,
//         calcium: 0,
//         goodCalories: 0,
//         badCalories: 0,
//         foodItems: [],
//       };
//       monthDoc.days.push(dayDoc);
//     }

//     /* ---------- Update Totals ---------- */
//     dayDoc.calories += calories;
//     dayDoc.protein += protein;
//     dayDoc.fat += fat;
//     dayDoc.carbs += carbs;
//     dayDoc.sugar += sugar;
//     dayDoc.calcium += calcium;

//     if (isGood) dayDoc.goodCalories += calories;
//     else dayDoc.badCalories += calories;

//     dayDoc.foodItems.push(foodItem);

//     userFood.markModified("nutritionByDate");
//     await userFood.save();

//     return res.json({
//       message: "JSON food added and totals updated",
//       today: `${day}/${month}/${year}`,
//       updatedDay: dayDoc,
//       nutritionByDate: userFood.nutritionByDate,
//     });

//   } catch (err) {
//     console.error("JSON FOOD ERROR:", err);
//     return res.status(500).json({ error: err.message });
//   }
// });



// /* =========================================================
//   2️⃣ GET ALL FOOD DATA
// ======================================================== */
// router.get("/listFood/:userId", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     const data = await FoodEntry.findOne({ userId });
//     return res.json(data || { userId, nutritionByDate: [] });
//   } catch (err) {
//     console.error("Error in /listFood:", err);
//     return res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// /* =========================================================
//   3️⃣ GET CUSTOM DATE RANGE DATA (scalable)
//      - startDate required "DD/MM/YYYY"
//      - endDate optional. If missing => single day result.
//      - Returns each day in the range (even empty)
// ======================================================== */
// router.post("/getCustomDateData", async (req, res) => {
//   try {
//     const { userId, startDate, endDate } = req.body;
//     if (!userId || !startDate)
//       return res.status(400).json({ error: "userId and startDate required" });

//     const food = await FoodEntry.findOne({ userId });
//     if (!food)
//       return res.json({ message: "No food data available", days: [] });

//     // Parse start
//     const [sDay, sMonth, sYear] = startDate.split("/").map(Number);
//     const start = new Date(sYear, sMonth - 1, sDay);

//     // Parse end or set to start
//     let end = start;
//     if (endDate) {
//       const [eDay, eMonth, eYear] = endDate.split("/").map(Number);
//       end = new Date(eYear, eMonth - 1, eDay);
//     }
//     // Treat range inclusive until end of day in IST
//     end.setHours(23, 59, 59, 999);

//     // Create date pointers in local time (we consider dates as simple day boundaries)
//     const range = [];
//     const pointer = new Date(start);
//     while (pointer <= end) {
//       range.push({
//         d: pointer.getDate(),
//         m: pointer.getMonth() + 1,
//         y: pointer.getFullYear(),
//         dateString: `${pointer.getDate()}/${pointer.getMonth() + 1}/${pointer.getFullYear()}`,
//       });
//       pointer.setDate(pointer.getDate() + 1);
//     }

//     const daysResult = range.map((dt) => {
//       const yearData = food.nutritionByDate.find((e) => e.year === dt.y);
//       const monthData = yearData?.months.find((e) => e.month === dt.m);
//       const dayData = monthData?.days.find((e) => e.day === dt.d);

//       const totals = {
//         calories: dayData?.calories || 0,
//         protein: dayData?.protein || 0,
//         fat: dayData?.fat || 0,
//         carbs: dayData?.carbs || 0,
//         sugar: dayData?.sugar || 0,
//         calcium: dayData?.calcium || 0,
//       };

//       return {
//         date: dt.dateString,
//         totals,
//         message: dayData ? "Food eaten on this day" : "Not eaten anything on this day",
//       };
//     });

//     if (daysResult.length === 1) {
//       return res.json({ message: "Single day data", day: daysResult[0] });
//     }

//     return res.json({
//       message: "Date range data fetched",
//       from: startDate,
//       to: endDate || startDate,
//       daysCount: daysResult.length,
//       days: daysResult,
//     });
//   } catch (err) {
//     console.error("Error in /getCustomDateData:", err);
//     return res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// /* =========================================================
//   4️⃣ TODAY'S SUMMARY (Homepage) — using IST
// ======================================================== */
// router.get("/dataHomepage/:userId", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     const today = getISTDate();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     const food = await FoodEntry.findOne({ userId });
//     if (!food) {
//       return res.json({
//         consumed: { calories: 0, protein: 0, fat: 0, carb: 0 },
//         today: `${d}/${m}/${y}`,
//         nutritionByDate: [],
//       });
//     }

//     const yearData = food.nutritionByDate.find((e) => e.year === y);
//     const monthData = yearData?.months.find((e) => e.month === m);
//     const dayData = monthData?.days.find((e) => e.day === d);

//     const consumed = {
//       calories: dayData?.calories || 0,
//       protein: dayData?.protein || 0,
//       fat: dayData?.fat || 0,
//       carb: dayData?.carbs || 0,
//     };

//     return res.json({
//       consumed,
//       today: `${d}/${m}/${y}`,
//       nutritionByDate: food.nutritionByDate,
//     });
//   } catch (err) {
//     console.error("Error in /dataHomepage:", err);
//     return res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// /* =========================================================
//   DASHBOARD - ALL IN ONE (today, weekly, monthly, best/worst, most eaten)
//   Works even if profile is missing; targets will be empty in that case.
// ======================================================== */
// router.get("/dashboard/:userId", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     // load profile if exists
//     const profile = await UserProfile.findOne({ userId });
//     const food = await FoodEntry.findOne({ userId });

//     const today = getISTDate();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     // Today summary
//     let todayData = { calories: 0, protein: 0, fat: 0, carbs: 0 };
//     let todayItems = [];

//     if (food) {
//       const yData = food.nutritionByDate.find((e) => e.year === y);
//       const mData = yData?.months.find((e) => e.month === m);
//       const dData = mData?.days.find((e) => e.day === d);

//       if (dData) {
//         todayData = {
//           calories: dData.calories || 0,
//           protein: dData.protein || 0,
//           fat: dData.fat || 0,
//           carbs: dData.carbs || 0,
//         };
//         todayItems = dData.foodItems || [];
//       }
//     }

//     // Weekly summary (last 7 days incl today)
//     let weekly = [];
//     if (food) {
//       const base = new Date(today);
//       const weekDates = [];
//       for (let i = 0; i < 7; i++) {
//         const dt = new Date(base);
//         dt.setDate(base.getDate() - i);
//         weekDates.push(dt);
//       }
//       weekDates.reverse().forEach((dt) => {
//         const yy = dt.getFullYear();
//         const mm = dt.getMonth() + 1;
//         const dd = dt.getDate();
//         const yData = food.nutritionByDate.find((e) => e.year === yy);
//         const mData = yData?.months.find((e) => e.month === mm);
//         const dData = mData?.days.find((e) => e.day === dd);
//         weekly.push({
//           date: `${dd}/${mm}/${yy}`,
//           calories: dData?.calories || 0,
//         });
//       });
//     }

//     // Monthly summary (current month)
//     let monthly = [];
//     if (food) {
//       const numDays = new Date(y, m, 0).getDate();
//       const yData = food.nutritionByDate.find((e) => e.year === y);
//       const mData = yData?.months.find((e) => e.month === m);
//       for (let day = 1; day <= numDays; day++) {
//         const dData = mData?.days.find((e) => e.day === day);
//         monthly.push({
//           date: `${day}/${m}/${y}`,
//           calories: dData?.calories || 0,
//         });
//       }
//     }

//     // best / worst days
//     let best = null,
//       worst = null;
//     if (food) {
//       const allDays = [];
//       food.nutritionByDate.forEach((yy) => {
//         yy.months.forEach((mm) => {
//           mm.days.forEach((dd) => {
//             allDays.push({
//               date: `${dd.day}/${mm.month}/${yy.year}`,
//               calories: dd.calories || 0,
//             });
//           });
//         });
//       });
//       if (allDays.length > 0) {
//         best = allDays.reduce((a, b) => (a.calories >= b.calories ? a : b));
//         worst = allDays.reduce((a, b) => (a.calories <= b.calories ? a : b));
//       }
//     }

//     // most eaten foods
//     let mostEatenFoods = [];
//     if (food) {
//       const counter = {};
//       food.nutritionByDate.forEach((yy) => {
//         yy.months.forEach((mm) => {
//           mm.days.forEach((dd) => {
//             dd.foodItems.forEach((it) => {
//               const key = it.label || it.name || "Unknown";
//               counter[key] = (counter[key] || 0) + 1;
//             });
//           });
//         });
//       });
//       mostEatenFoods = Object.entries(counter)
//         .map(([label, count]) => ({ label, count }))
//         .sort((a, b) => b.count - a.count);
//     }

//     return res.json({
//       message: "Dashboard data loaded",
//       data: {
//         today: {
//           date: `${d}/${m}/${y}`,
//           target: profile
//             ? {
//                 calories: profile.targetCalorie,
//                 protein: profile.targetProtein,
//                 fat: profile.targetFat,
//                 carb: profile.targetCarb,
//               }
//             : {},
//           consumed: todayData,
//           items: todayItems,
//         },
//         weekly,
//         monthly,
//         best,
//         worst,
//         mostEatenFoods,
//       },
//     });
//   } catch (err) {
//     console.error("Error in /dashboard:", err);
//     return res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// /* =========================================================
//   AI Nutrition Advisor
//   - Works even if profile missing: we pass best-available info to AI
//   - Response expected as pure JSON from LLM (we try to parse)
// ======================================================== */
// router.post("/aiNutritionAdvisor", async (req, res) => {
//   try {
//     const { userId } = req.body;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     // load profile if exists (optional)
//     const profile = await UserProfile.findOne({ userId });
//     const food = await FoodEntry.findOne({ userId });

//     // IST today
//     const today = getISTDate();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     // Today's consumption from food entries
//     const yData = food?.nutritionByDate.find((e) => e.year === y);
//     const mData = yData?.months.find((e) => e.month === m);
//     const dData = mData?.days.find((e) => e.day === d);

//     const consumed = {
//       calories: dData?.calories || 0,
//       protein: dData?.protein || 0,
//       fat: dData?.fat || 0,
//       carbs: dData?.carbs || 0,
//       sugar: dData?.sugar || 0,
//       calcium: dData?.calcium || 0,
//     };

//     // If profile missing, create a fallback target object (zeros)
//     const target = profile
//       ? {
//           calories: profile.targetCalorie || 0,
//           protein: profile.targetProtein || 0,
//           fat: profile.targetFat || 0,
//           carb: profile.targetCarb || 0,
//         }
//       : { calories: 0, protein: 0, fat: 0, carb: 0 };

//     // Build AI prompt — instruct to return JSON only
//     const prompt = `
// You are a helpful nutrition assistant. Respond ONLY with valid JSON (no extra text).
// User basic info:
// ${profile ? `Age: ${profile.age}, Gender: ${profile.gender}, Goal: ${profile.goal}` : "No profile available."}

// Targets:
// ${JSON.stringify(target)}

// Today's consumption:
// ${JSON.stringify(consumed)}

// Return JSON object with keys:
// - deficiencies: array of short strings (e.g. "protein low")
// - recommendFoods: array of foods to eat to cover deficiencies
// - avoidFoods: array of foods to avoid
// - supplements: array of supplement names if recommended
// - summary: short single-line summary

// Example:
// {"deficiencies":["protein low"],"recommendFoods":["eggs","paneer"],"avoidFoods":["sugar"],"supplements":["Omega 3"],"summary":"Short text"}
// `;

//     // Call the responses endpoint
//     let aiOutputRaw;
//     try {
//       const aiResp = await client.responses.create({
//         model: "openai/gpt-oss-20b",
//         input: prompt,
//       });
//       // responses.create returns .output_text property in our earlier examples
//       aiOutputRaw = aiResp.output_text || JSON.stringify(aiResp);
//     } catch (e) {
//       console.error("AI call failed:", e);
//       return res.status(500).json({ error: "AI service error" });
//     }

//     let advice;
//     try {
//       advice = JSON.parse(aiOutputRaw);
//     } catch (e) {
//       // If not valid JSON, return raw plus error note
//       advice = { error: "AI returned non-JSON", raw: aiOutputRaw };
//     }

//     return res.json({
//       message: "AI Nutrition Advice",
//       date: `${d}/${m}/${y}`,
//       consumed,
//       target,
//       advice,
//     });
//   } catch (err) {
//     console.error("Error in /aiNutritionAdvisor:", err);
//     return res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// module.exports = router;
