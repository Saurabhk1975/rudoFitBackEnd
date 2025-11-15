// const express = require("express");
// const multer = require("multer");
// const router = express.Router();
// const FoodEntry = require("../models/FoodEntry");
// const UserProfile = require("../models/UserProfile");
// const OpenAI = require("openai");
// const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY });

// /* ------------------ MULTER CONFIG ------------------ */
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
// });
// const upload = multer({ storage });

// /* ------------------ AI HELPER ------------------ */
// const askAIForNutrition = async (input) => {
//   const prompt = `Give me approximate nutrition in JSON for this food in gram: ${input}. Format:
//   {"calories":200,"protein":10,"fat":5,"carbs":30,"sugar":2,"calcium":20}`;
//   const response = await client.chat.completions.create({
//     model: "llama3-8b-8192",
//     messages: [{ role: "user", content: prompt }],
//   });
//   return JSON.parse(response.choices[0].message.content);
// };

// /* =========================================================
//    1️⃣  ADD FOOD (JSON / IMAGE / CUSTOM TEXT)
// ========================================================= */
// router.post("/addFood", upload.single("image"), async (req, res) => {
//   try {
//     const { userId, foodData, customText } = req.body;

//     if (!userId) return res.status(400).json({ error: "userId required" });

//     let aiResult;

//     // ✅ On JSON input
//     if (foodData) {
//       aiResult = JSON.parse(foodData);
//     }
//     // ✅ On Image upload
//     else if (req.file) {
//       aiResult = await askAIForNutrition(
//         `Describe food in image: ${req.file.path}`
//       );
//     }
//     // ✅ On Text input
//     else if (customText) {
//       aiResult = await askAIForNutrition(customText);
//     } else {
//       return res
//         .status(400)
//         .json({ error: "Provide foodData or image or customText" });
//     }

//     // ✅ AI label & good/bad classification
//     const labelPrompt = `
//       Give me a clean food title and health classification for this food:
//       "${customText || "food image"}"

//       Return JSON only like:
//       {"label":"Chapati With Omelette","healthTag":"good_to_have","reason":"High protein, balanced carbs."}
//     `;
//     const labelResponse = await client.chat.completions.create({
//       model: "llama3-8b-8192",
//       messages: [{ role: "user", content: labelPrompt }],
//     });

//     const foodLabelData = JSON.parse(labelResponse.choices[0].message.content);

//     const today = new Date();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     let userFood = await FoodEntry.findOne({ userId });
//     if (!userFood) userFood = new FoodEntry({ userId, nutritionByDate: [] });

//     let yearData = userFood.nutritionByDate.find((e) => e.year === y);
//     if (!yearData) {
//       yearData = { year: y, months: [] };
//       userFood.nutritionByDate.push(yearData);
//     }

//     let monthData = yearData.months.find((e) => e.month === m);
//     if (!monthData) {
//       monthData = { month: m, days: [] };
//       yearData.months.push(monthData);
//     }

//     let dayData = monthData.days.find((e) => e.day === d);
//     if (!dayData) {
//       dayData = {
//         day: d,
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
//       monthData.days.push(dayData);
//     }

//     // ✅ Update daily totals
//     for (const key in aiResult) {
//       dayData[key] = (dayData[key] || 0) + (aiResult[key] || 0);
//     }

//     if (foodLabelData.healthTag === "good_to_have") {
//       dayData.goodCalories += aiResult.calories;
//     } else {
//       dayData.badCalories += aiResult.calories;
//     }

//     // ✅ Save food item
//     dayData.foodItems.push({
//       name: customText || "Uploaded food",
//       label: foodLabelData.label,
//       healthTag: foodLabelData.healthTag,
//       ...aiResult,
//       imageUrl: req.file ? req.file.path : null,
//       sourceType: req.file ? "image" : foodData ? "json" : "text",
//     });

//     await userFood.save();

//     res.json({ message: "✅ Food added successfully", userFood });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// /* =========================================================
//    2️⃣  LIST FOOD
// ========================================================= */
// router.get("/listFood/:userId", async (req, res) => {
//   const food = await FoodEntry.findOne({ userId: req.params.userId });
//   res.json(food || {});
// });

// /* =========================================================
//    3️⃣  GET CUSTOM DATE DATA
// ========================================================= */
// router.post("/getCustomDateData", async (req, res) => {
//   try {
//     const { userId, startDate, endDate } = req.body;

//     if (!userId || !startDate)
//       return res
//         .status(400)
//         .json({ error: "userId and startDate are required" });

//     const [startDay, startMonth, startYear] = startDate.split("/").map(Number);
//     const start = new Date(startYear, startMonth - 1, startDay);
//     const end = endDate
//       ? (() => {
//           const [d, m, y] = endDate.split("/").map(Number);
//           return new Date(y, m - 1, d);
//         })()
//       : start;

//     const data = await FoodEntry.findOne({ userId });
//     if (!data) return res.json({ message: "No data found for user" });

//     let total = {
//       calories: 0,
//       protein: 0,
//       fat: 0,
//       carbs: 0,
//       sugar: 0,
//       calcium: 0,
//     };
//     let tracker = 0;

//     data.nutritionByDate.forEach((year) => {
//       year.months.forEach((month) => {
//         month.days.forEach((day) => {
//           const entryDate = new Date(year.year, month.month - 1, day.day);
//           if (entryDate >= start && entryDate <= end) {
//             tracker++;
//             for (let key in total) {
//               total[key] += day[key] || 0;
//             }
//           }
//         });
//       });
//     });

//     if (tracker === 0)
//       return res.json({ message: "No data found for given date range" });

//     res.json({
//       message: "✅ Data fetched successfully",
//       userId,
//       from: startDate,
//       to: endDate || startDate,
//       daysCount: tracker,
//       totals: total,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// /* =========================================================
//    4️⃣  GET HOMEPAGE DATA (TODAY’S SUMMARY)
// ========================================================= */
// router.get("/dataHomepage/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const today = new Date();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     const profile = await UserProfile.findOne({ userId });
//     const food = await FoodEntry.findOne({ userId });

//     if (!profile) return res.json({ message: "Profile not found" });
//     if (!food) return res.json({ message: "No food data found" });

//     const yearData = food.nutritionByDate.find((e) => e.year === y);
//     const monthData = yearData?.months.find((e) => e.month === m);
//     const dayData = monthData?.days.find((e) => e.day === d);

//     if (!dayData) return res.json({ message: "No food data for today" });

//     const response = {
//       userId,
//       date: `${d}/${m}/${y}`,
//       target: {
//         calories: profile.targetCalorie,
//         protein: profile.targetProtein,
//         fat: profile.targetFat,
//         carb: profile.targetCarb,
//       },
//       consumed: {
//         calories: dayData.calories,
//         protein: dayData.protein,
//         fat: dayData.fat,
//         carb: dayData.carbs,
//       },
//     };

//     res.json({
//       message: "✅ Homepage data fetched successfully",
//       data: response,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");

// 🔑 FIX: Configured to use Groq API by setting the baseURL
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* ------------------ MULTER CONFIG ------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    // Ensure the uploads directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });


/* ------------------ JSON CLEANER ------------------ */
// Helper to extract JSON object from potentially messy AI text response
const extractJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.error("JSON extraction failed:", e.message);
    return null;
  }
};

/* ------------------ AI HELPERS ------------------ */
const askAIForNutrition = async (input) => {
  const prompt = `You are a nutrition expert and if quantity is not specified, assume a standard serving size in indian village area take minium value in grams.

Provide approximate nutrition values in grams for this food. like if bowl is not mentioned then assume smallest bowl size. if food name is not clear what is content for example daal then take daal which has minimum protien. like this assume minimum values.

Return ONLY JSON (no text) like:
{"calories":200,"protein":10,"fat":5,"carbs":30,"sugar":2,"calcium":20}

Food: ${input}`;

  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-20b", // Groq's Llama 3 model
    messages: [{ role: "user", content: prompt }],
  });

  return extractJSON(response.choices[0].message.content);
};

const askAIForLabel = async (text) => {
  const prompt = `
Provide title + health tag ONLY in JSON.

Example:
{"label":"Chapati With Omelette","healthTag":"good_to_have","reason":"Balanced protein & carbs"}

Food: ${text}
`;

  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-20b", // Groq's Llama 3 model
    messages: [{ role: "user", content: prompt }],
  });

  return extractJSON(response.choices[0].message.content);
};

/* =========================================================
  1️⃣ ADD FOOD (JSON / IMAGE / CUSTOM TEXT)
========================================================= */
// router.post("/addFood", upload.single("image"), async (req, res) => {
//   const fileUploaded = !!req.file;

//   const cleanupFile = () => {
//     if (fileUploaded)
//       fs.unlink(req.file.path, (e) => {
//         if (e) console.error("Failed to delete temp file:", e);
//       });
//   };

//   try {
//     const body = req.body;
//     const { userId } = body;

//     if (!userId) {
//       cleanupFile();
//       return res.status(400).json({ error: "userId required" });
//     }

//     let aiResult;
//     let labelData;
//     let foodName = "Food Item";
//     let sourceType;

//     // ✅ JSON input
//     if (body.foodData) {
//       try {
//         aiResult = JSON.parse(body.foodData);
//         labelData = await askAIForLabel(body.foodData);
//         foodName = `Custom JSON Food: ${labelData?.label || "Unknown"}`;
//         sourceType = "json";
//       } catch (e) {
//         cleanupFile();
//         return res
//           .status(400)
//           .json({ error: "foodData field is not valid JSON string" });
//       }
//     }
//     // ✅ Text input
//     else if (body.customText) {
//       aiResult = await askAIForNutrition(body.customText);
//       labelData = await askAIForLabel(body.customText);
//       foodName = body.customText;
//       sourceType = "text";
//     }
//     // ✅ Image input
//     else if (req.file) {
//       // NOTE: Groq's Llama 3 is text-only. It cannot see the image content.
//       // We pass the filename/a generic prompt for analysis.
//       aiResult = await askAIForNutrition(
//         "Food image uploaded with filename: " + req.file.originalname
//       );
//       labelData = await askAIForLabel("Food from image");
//       foodName = "Image Food";
//       sourceType = "image";
//     } else {
//       cleanupFile();
//       return res
//         .status(400)
//         .json({ error: "Provide foodData (JSON), customText, or an image." });
//     }

//     // --- Validation and Fallback ---
//     if (!aiResult) {
//       cleanupFile();
//       return res
//         .status(400)
//         .json({ error: "AI failed to return nutrition JSON. Try rephrasing." });
//     }
//     if (!labelData) {
//       cleanupFile();
//       return res
//         .status(400)
//         .json({ error: "AI failed to return label JSON. Try rephrasing." });
//     }
//     const entryCalories = aiResult.calories || 0;

//     // --- Database Aggregation ---
//     const today = new Date();
//     const y = today.getFullYear();
//     const m = today.getMonth() + 1;
//     const d = today.getDate();

//     let userFood = await FoodEntry.findOne({ userId });
//     if (!userFood) userFood = new FoodEntry({ userId, nutritionByDate: [] });

//     let yearData = userFood.nutritionByDate.find((e) => e.year === y);
//     if (!yearData) {
//       yearData = { year: y, months: [] };
//       userFood.nutritionByDate.push(yearData);
//     }

//     let monthData = yearData.months.find((e) => e.month === m);
//     if (!monthData) {
//       monthData = { month: m, days: [] };
//       yearData.months.push(monthData);
//     }

//     let dayData = monthData.days.find((e) => e.day === d);
//     if (!dayData) {
//       dayData = {
//         day: d,
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
//       monthData.days.push(dayData);
//     }

//     // ✅ Update daily totals
//     for (const key in aiResult) {
//       if (dayData.hasOwnProperty(key) && !isNaN(aiResult[key])) {
//         dayData[key] = (dayData[key] || 0) + (aiResult[key] || 0);
//       }
//     }

//     if (labelData.healthTag === "good_to_have")
//       dayData.goodCalories += entryCalories;
//     else dayData.badCalories += entryCalories;

//     // ✅ Insert food entry
//     const newFoodEntry = {
//       name: foodName,
//       label: labelData.label,
//       healthTag: labelData.healthTag,
//       ...aiResult,
//       imageUrl: fileUploaded ? req.file.path : null,
//       sourceType: sourceType,
//     };

//     dayData.foodItems.push(newFoodEntry);

//     await userFood.save();

//     cleanupFile();

//     res.json({
//       message: "✅ Food added successfully",
//       addedItem: newFoodEntry,
//       todaySummary: dayData,
//     });
//   } catch (err) {
//     console.error("🔥 Error in /addFood:", err);
//     cleanupFile();
//     res.status(500).json({ error: err.message });
//   }
// });
router.post("/addFood", upload.single("image"), async (req, res) => {
  const fileUploaded = !!req.file;

  const cleanup = () => {
    if (fileUploaded)
      fs.unlink(req.file.path, () => {});
  };

  try {
    const { userId, foodData, customText } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    let aiResult, labelData, foodName, sourceType;

    /* ---------- INPUT HANDLING ---------- */
    if (foodData) {
      aiResult = JSON.parse(foodData);
      labelData = await askAIForLabel(foodData);
      foodName = labelData.label || "Custom Food";
      sourceType = "json";
    } else if (customText) {
      aiResult = await askAIForNutrition(customText);
      labelData = await askAIForLabel(customText);
      foodName = customText;
      sourceType = "text";
    } else if (req.file) {
      aiResult = await askAIForNutrition("Food image uploaded");
      labelData = await askAIForLabel("Food image uploaded");
      foodName = "Image Food";
      sourceType = "image";
    } else {
      return res
        .status(400)
        .json({ error: "Provide foodData, customText, or image" });
    }

    if (!aiResult || !labelData) {
      return res
        .status(400)
        .json({ error: "AI did not return valid JSON" });
    }

    const calories = aiResult.calories || 0;
    const isGood = labelData.healthTag === "good_to_have";

    /* ---------- DATE STRUCTURE ---------- */
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    /* ---------- FOOD ITEM STRUCTURE ---------- */
    const foodItem = {
      name: foodName,
      label: labelData.label,
      healthTag: labelData.healthTag,
      ...aiResult,
      imageUrl: fileUploaded ? req.file.path : null,
      sourceType,
    };

    /* =======================================================
        ⭐ 1️⃣ ENSURE ROOT DOCUMENT EXISTS
    ======================================================= */
    await FoodEntry.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          nutritionByDate: [],
        },
      },
      { upsert: true }
    );

    /* =======================================================
        ⭐ 2️⃣ ENSURE YEAR EXISTS
    ======================================================= */
    await FoodEntry.updateOne(
      {
        userId,
        "nutritionByDate.year": { $ne: y },
      },
      {
        $push: {
          nutritionByDate: {
            year: y,
            months: [],
          },
        },
      }
    );

    /* =======================================================
        ⭐ 3️⃣ ENSURE MONTH EXISTS
    ======================================================= */
    await FoodEntry.updateOne(
      {
        userId,
        "nutritionByDate.year": y,
        "nutritionByDate.months.month": { $ne: m },
      },
      {
        $push: {
          "nutritionByDate.$.months": {
            month: m,
            days: [],
          },
        },
      }
    );

    /* =======================================================
        ⭐ 4️⃣ ENSURE DAY EXISTS
    ======================================================= */
    await FoodEntry.updateOne(
      {
        userId,
        "nutritionByDate.year": y,
        "nutritionByDate.months.month": m,
        "nutritionByDate.months.days.day": { $ne: d },
      },
      {
        $push: {
          "nutritionByDate.$[year].months.$[month].days": {
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
          },
        },
      },
      {
        arrayFilters: [
          { "year.year": y },
          { "month.month": m },
        ],
      }
    );

    /* =======================================================
        ⭐ 5️⃣ PUSH FOOD + UPDATE TOTALS (ATOMIC)
    ======================================================= */
    await FoodEntry.updateOne(
      { userId },
      {
        $push: {
          "nutritionByDate.$[year].months.$[month].days.$[day].foodItems":
            foodItem,
        },
        $inc: {
          "nutritionByDate.$[year].months.$[month].days.$[day].calories":
            calories,
          "nutritionByDate.$[year].months.$[month].days.$[day].protein":
            aiResult.protein || 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].fat":
            aiResult.fat || 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].carbs":
            aiResult.carbs || 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].sugar":
            aiResult.sugar || 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].calcium":
            aiResult.calcium || 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].goodCalories":
            isGood ? calories : 0,
          "nutritionByDate.$[year].months.$[month].days.$[day].badCalories":
            isGood ? 0 : calories,
        },
      },
      {
        arrayFilters: [
          { "year.year": y },
          { "month.month": m },
          { "day.day": d },
        ],
      }
    );

    cleanup();

    res.json({
      message: "✅ Food added successfully",
      addedItem: foodItem,
    });
  } catch (err) {
    cleanup();
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
  2️⃣ LIST FOOD
========================================================= */
router.get("/listFood/:userId", async (req, res) => {
  const food = await FoodEntry.findOne({ userId: req.params.userId });
  res.json(food || { message: "No food data found for user" });
});

/* =========================================================
  3️⃣ GET CUSTOM DATE DATA
========================================================= */
router.post("/getCustomDateData", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId || !startDate)
      return res
        .status(400)
        .json({ error: "userId and startDate are required" });

    const [startDay, startMonth, startYear] = startDate.split("/").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);

    let end;
    if (endDate) {
      const [d, m, y] = endDate.split("/").map(Number);
      end = new Date(y, m - 1, d);
    } else {
      end = new Date(startYear, startMonth - 1, startDay);
    }

    end.setHours(23, 59, 59, 999);

    const data = await FoodEntry.findOne({ userId });
    if (!data) return res.json({ message: "No data found for user" });

    let total = {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      sugar: 0,
      calcium: 0,
    };
    let tracker = 0;

    data.nutritionByDate.forEach((year) => {
      year.months.forEach((month) => {
        month.days.forEach((day) => {
          const entryDate = new Date(year.year, month.month - 1, day.day);

          if (entryDate >= start && entryDate <= end) {
            tracker++;
            for (let key in total) {
              total[key] += day[key] || 0;
            }
          }
        });
      });
    });

    if (tracker === 0)
      return res.json({ message: "No data found for given date range" });

    res.json({
      message: "✅ Data fetched successfully",
      userId,
      from: startDate,
      to: endDate || startDate,
      daysCount: tracker,
      totals: total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
  4️⃣ GET HOMEPAGE DATA (TODAY’S SUMMARY)
========================================================= */
router.get("/dataHomepage/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    const [profile, food] = await Promise.all([
      UserProfile.findOne({ userId }),
      FoodEntry.findOne({ userId }),
    ]);

    if (!profile) return res.json({ message: "Profile not found" });

    const yearData = food?.nutritionByDate.find((e) => e.year === y);
    const monthData = yearData?.months.find((e) => e.month === m);
    const dayData = monthData?.days.find((e) => e.day === d);

    const consumed = {
      calories: dayData?.calories || 0,
      protein: dayData?.protein || 0,
      fat: dayData?.fat || 0,
      carb: dayData?.carbs || 0,
    };

    const response = {
      userId,
      date: `${d}/${m}/${y}`,
      target: {
        calories: profile.targetCalorie,
        protein: profile.targetProtein,
        fat: profile.targetFat,
        carb: profile.targetCarb,
      },
      consumed: consumed,
    };

    res.json({
      message: "✅ Homepage data fetched successfully",
      data: response,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
