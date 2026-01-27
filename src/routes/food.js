// const express = require("express");
// const multer = require("multer");
// const OpenAI = require("openai");
// const router = express.Router();

// const FoodEntry = require("../models/FoodEntry");
// const UserProfile = require("../models/UserProfile");
// const YesterdayMessage = require("../models/Yesterday_Message");
// const { generateYesterdayMessage } = require("../services/yesterdayMessageService.js"); 
// const upload = multer({ dest: "uploads/" });

// function getISTDate() {
//   return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
// }

// function toISODate(date) {
//   const y = date.getFullYear();
//   const m = String(date.getMonth() + 1).padStart(2, "0");
//   const d = String(date.getDate()).padStart(2, "0");
//   return `${y}-${m}-${d}`;
// }

// const clean = (v) => (isNaN(Number(v)) ? 0 : Number(v));


// const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1",
// });
// // 🔹 OpenAI client for IMAGE (GPT-5 nano)
// const imageClient = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// async function askAIForNutrition(text) {
//   const prompt = `
// Return ONLY JSON and quantity should me be minimum if not mentioned clearly, then take the smallest quantity and also try to match or take reference from USDA and open food facts:
// {"calories":number,"protein":number,"fat":number,"carbs":number,"sugar":number,"calcium":number}
// Food: ${text}
// `;
//   const r = await client.chat.completions.create({
//     model: "openai/gpt-oss-20b",
//     messages: [{ role: "user", content: prompt }],
//   });
//   return JSON.parse(r.choices[0].message.content);
// }

// async function askAIForLabel(text) {
//   const prompt = `
// Return ONLY JSON:
// {"label":"Food name","healthTag":"good_to_have|bad_to_have|average"}
// Food: ${text}
// `;
//   const r = await client.chat.completions.create({
//     model: "openai/gpt-oss-20b",
//     messages: [{ role: "user", content: prompt }],
//   });
//   return JSON.parse(r.choices[0].message.content);
// }
// // 🧠 IMAGE → FOOD → NUTRITION (GPT-5 nano)
// async function askAIForImageNutrition(imagePath) {
//   const fs = require("fs");
//   const imageBase64 = fs.readFileSync(imagePath, "base64");

//   const prompt = `
// You are a nutrition expert.
// From the image, identify food items and assume MINIMUM quantity.
// Use USDA/OpenFoodFacts reference.
// Return ONLY JSON in this exact format:

// {
//   "name": "Food name",
//   "healthTag": "good_to_have|bad_to_have|average",
//   "calories": number,
//   "protein": number,
//   "fat": number,
//   "carbs": number,
//   "sugar": number,
//   "calcium": number
// }
// `;

//   const response = await imageClient.responses.create({
//     model: "gpt-5-nano",
//     input: [
//       {
//         role: "user",
//         content: [
//           { type: "input_text", text: prompt },
//           { type: "input_image", image_base64: imageBase64 },
//         ],
//       },
//     ],
//   });

//   return JSON.parse(response.output_text);
// }


// router.post("/addFood", upload.single("image"), async (req, res) => {
//   try {
//     const { userId, foodData, customText } = req.body;
//     if (!userId) return res.status(400).json({ error: "userId required" });

//     let nutrition, label, name, sourceType;

//     /* ---------- JSON INPUT ---------- */
//     if (foodData) {
//       const data = typeof foodData === "string" ? JSON.parse(foodData) : foodData;

//       nutrition = {
//         calories: clean(data.calories),
//         protein: clean(data.protein),
//         fat: clean(data.fat),
//         carbs: clean(data.carbs),
//         sugar: clean(data.sugar),
//         calcium: clean(data.calcium),
//       };

//       name = data.name || "Custom Food";
//       label = {
//         label: name,
//         healthTag: data.healthTag || "average",
//       };
//       sourceType = "json";
//     }

//     /* ---------- TEXT INPUT ---------- */
//     else if (customText) {
//       nutrition = await askAIForNutrition(customText);
//       label = await askAIForLabel(customText);
//       name = customText;
//       sourceType = "text";
//     }

//     /* ---------- IMAGE INPUT ---------- */
//    /* ---------- IMAGE INPUT (GPT-5 NANO) ---------- */
// else if (req.file) {
//   const imgResult = await askAIForImageNutrition(req.file.path);

//   nutrition = {
//     calories: clean(imgResult.calories),
//     protein: clean(imgResult.protein),
//     fat: clean(imgResult.fat),
//     carbs: clean(imgResult.carbs),
//     sugar: clean(imgResult.sugar),
//     calcium: clean(imgResult.calcium),
//   };

//   name = imgResult.name || "Image Food";
//   label = {
//     label: name,
//     healthTag: imgResult.healthTag || "average",
//   };

//   sourceType = "image";
// }
// else {
//       return res.status(400).json({ error: "No food input provided" });
//     }

//     const now = getISTDate();
//     const date = toISODate(now);

//     const foodItem = {
//       name,
//       label: label.label,
//       healthTag: label.healthTag,
//       ...nutrition,
//       imageUrl: req.file?.path || null,
//       sourceType,
//       createdAt: now,
//     };

//     /* ---------- CALORIE BUCKET LOGIC ---------- */
//     const inc = {
//       calories: nutrition.calories,
//       protein: nutrition.protein,
//       fat: nutrition.fat,
//       carbs: nutrition.carbs,
//       sugar: nutrition.sugar,
//       calcium: nutrition.calcium,
//       goodCalories: 0,
//       badCalories: 0,
//       avgCalories: 0,
//     };

//     if (label.healthTag === "good_to_have") inc.goodCalories = nutrition.calories;
//     else if (label.healthTag === "bad_to_have") inc.badCalories = nutrition.calories;
//     else inc.avgCalories = nutrition.calories;

//     /* ---------- ATOMIC UPSERT ---------- */
//     await FoodEntry.updateOne(
//       { userId, date },
//       {
//         $setOnInsert: {
//           userId,
//           date,
//           year: now.getFullYear(),
//           month: now.getMonth() + 1,
//           day: now.getDate(),
//         },
//         $inc: {
//           "totals.calories": inc.calories,
//           "totals.protein": inc.protein,
//           "totals.fat": inc.fat,
//           "totals.carbs": inc.carbs,
//           "totals.sugar": inc.sugar,
//           "totals.calcium": inc.calcium,
//           "totals.goodCalories": inc.goodCalories,
//           "totals.badCalories": inc.badCalories,
//           "totals.avgCalories": inc.avgCalories,
//         },
//         $push: { foodItems: foodItem },
//       },
//       { upsert: true }
//     );

//     res.json({ message: "Food added successfully", date });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });


// // router.get("/today/:userId", async (req, res) => {
// //   const date = toISODate(getISTDate());
// //   const doc = await FoodEntry.findOne({ userId: req.params.userId, date });

// //   res.json({
// //     date,
// //     totals: doc?.totals || {},
// //     items: doc?.foodItems || [],
// //   });
// // });

// // router.get("/today/:userId", async (req, res) => {
// //   try {
// //     const today = toISODate(getISTDate());
// //     const { userId } = req.params;

// //     // Fetch food entry for today
// //     const doc = await FoodEntry.findOne({ userId, date: today }).lean();

// //     // Fetch user profile for goal and targets
// //     let userProfile = await UserProfile.findOne({ userId });

// //     // Check if showRegistered is true and validate profile completeness
// //     if (userProfile && userProfile.showRegistered === true) {
// //       const requiredFields = [
// //         'userId', 'name', 'mobileNumber', 'age', 'gender', 
// //         'weight', 'height', 'weightUnit', 'heightUnit', 
// //         'targetWeight', 'goal', 'physicalActivity'
// //       ];
      
// //       const allFieldsComplete = requiredFields.every(field => {
// //         const value = userProfile[field];
// //         return value !== null && value !== undefined && value !== '';
// //       });

// //       // If all fields are complete, update showRegistered to false
// //       if (allFieldsComplete) {
// //         userProfile.showRegistered = false;
// //         await userProfile.save();
// //       }
// //     }

// //     const profileData = {
// //       goal: userProfile?.goal || null,
// //       targetCalorie: userProfile?.targetCalorie || 0,
// //       targetProtein: userProfile?.targetProtein || 0,
// //       showRegistered: userProfile?.showRegistered ?? true,
// //     };

// //     if (doc) {
// //       return res.json({
// //         date: today,
// //         totals: doc.totals,
// //         items: doc.foodItems || [],
// //         ...profileData,
// //         message: "Food eaten today",
// //       });
// //     }

// //     // No entry today → return zero
// //     res.json({
// //       date: today,
// //       totals: {
// //         calories: 0,
// //         protein: 0,
// //         fat: 0,
// //         carbs: 0,
// //         sugar: 0,
// //         calcium: 0,
// //         goodCalories: 0,
// //         badCalories: 0,
// //         avgCalories: 0,
// //       },
// //       items: [],
// //       ...profileData,
// //       message: "No food eaten today",
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });


// router.get("/today/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const today = toISODate(getISTDate());

//     // ================================
//     // 1️⃣ Fetch today food entry
//     // ================================
//     const doc = await FoodEntry.findOne({ userId, date: today }).lean();

//     // ================================
//     // 2️⃣ Fetch user profile
//     // ================================
//     const userProfile = await UserProfile.findOne({ userId }).lean();

//     // ================================
//     // 3️⃣ showRegistered logic (as-is)
//     // ================================
//     if (userProfile && userProfile.showRegistered === true) {
//       const requiredFields = [
//         "userId",
//         "name",
//         "mobileNumber",
//         "age",
//         "gender",
//         "weight",
//         "height",
//         "weightUnit",
//         "heightUnit",
//         "targetWeight",
//         "goal",
//         "physicalActivity",
//       ];

//       const allFieldsComplete = requiredFields.every((field) => {
//         const value = userProfile[field];
//         return value !== null && value !== undefined && value !== "";
//       });

//       if (allFieldsComplete) {
//         await UserProfile.updateOne(
//           { userId },
//           { $set: { showRegistered: false } }
//         );
//       }
//     }

//     const profileData = {
//       goal: userProfile?.goal || null,
//       targetCalorie: userProfile?.targetCalorie || 0,
//       targetProtein: userProfile?.targetProtein || 0,
//       showRegistered: userProfile?.showRegistered ?? true,
//     };

//     // ================================
//     // 4️⃣ Send response FIRST
//     // ================================
//     const responsePayload = doc
//       ? {
//           date: today,
//           totals: doc.totals,
//           items: doc.foodItems || [],
//           ...profileData,
//           message: "Food eaten today",
//         }
//       : {
//           date: today,
//           totals: {
//             calories: 0,
//             protein: 0,
//             fat: 0,
//             carbs: 0,
//             sugar: 0,
//             calcium: 0,
//             goodCalories: 0,
//             badCalories: 0,
//             avgCalories: 0,
//           },
//           items: [],
//           ...profileData,
//           message: "No food eaten today",
//         };

//     res.json(responsePayload);

//     // =====================================================
//     // 5️⃣ BACKGROUND JOB (NO DB LOGIC HERE)
//     // =====================================================
//     setImmediate(async () => {
//       try {
//         console.log("🟡 Triggering yesterday message for:", userId);
//         await generateYesterdayMessage(userId);
//         console.log("🟢 Yesterday message job done:", userId);
//       } catch (err) {
//         console.error("❌ Yesterday background error:", err.message);
//       }
//     });

//   } catch (err) {
//     console.error("Today API error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// router.get("/weekly/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const today = getISTDate();

//     // Build last 7 days
//     const daysMeta = [];
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date(today);
//       d.setDate(today.getDate() - i);

//       daysMeta.push({
//         year: d.getFullYear(),
//         month: d.getMonth() + 1,
//         day: d.getDate(),
//         iso: toISODate(d),
//       });
//     }

//     const docs = await FoodEntry.find({
//       userId,
//       $or: daysMeta.map(d => ({
//         year: d.year,
//         month: d.month,
//         day: d.day,
//       })),
//     }).lean();

//     const map = {};
//     docs.forEach(d => {
//       map[`${d.year}-${d.month}-${d.day}`] = d;
//     });

//     const totals_range = {
//       calories: 0,
//       protein: 0,
//       fat: 0,
//       carbs: 0,
//       sugar: 0,
//       calcium: 0,
//       goodCalories: 0,
//       badCalories: 0,
//     };

//     let loggedDays = 0;

//     const days = daysMeta.map(d => {
//       const key = `${d.year}-${d.month}-${d.day}`;

//       if (map[key]) {
//         const t = map[key].totals || {};
//         loggedDays++;

//         totals_range.calories += t.calories || 0;
//         totals_range.protein += t.protein || 0;
//         totals_range.fat += t.fat || 0;
//         totals_range.carbs += t.carbs || 0;
//         totals_range.sugar += t.sugar || 0;
//         totals_range.calcium += t.calcium || 0;
//         totals_range.goodCalories += t.goodCalories || 0;
//         totals_range.badCalories += t.badCalories || 0;

//         return {
//           date: d.iso,
//           totals: t,
//           items: map[key].foodItems || [],
//           message: "Food eaten",
//         };
//       }

//       return {
//         date: d.iso,
//         totals: {
//           calories: 0,
//           protein: 0,
//           fat: 0,
//           carbs: 0,
//           sugar: 0,
//           calcium: 0,
//           goodCalories: 0,
//           badCalories: 0,
//         },
//         items: [],
//         message: "No food eaten",
//       };
//     });

//     const totalDays = days.length;
//     const missedDays = totalDays - loggedDays;

//     // ✅ NEW: averages object
//     const averages = {
//       calories: loggedDays ? Math.round(totals_range.calories / loggedDays) : 0,
//       protein: loggedDays ? +(totals_range.protein / loggedDays).toFixed(1) : 0,
//       fat: loggedDays ? +(totals_range.fat / loggedDays).toFixed(1) : 0,
//       carbs: loggedDays ? +(totals_range.carbs / loggedDays).toFixed(1) : 0,
//       sugar: loggedDays ? +(totals_range.sugar / loggedDays).toFixed(1) : 0,
//       calcium: loggedDays ? +(totals_range.calcium / loggedDays).toFixed(1) : 0,
//       goodCalories: loggedDays
//         ? Math.round(totals_range.goodCalories / loggedDays)
//         : 0,
//       badCalories: loggedDays
//         ? Math.round(totals_range.badCalories / loggedDays)
//         : 0,
//     };

//     res.json({
//       range: "last_7_days",
//       totalDays,
//       loggedDays,
//       missedDays,
//       totals_range,
//       averages, // 👈 THIS IS WHAT YOU WANTED
//       days,
//     });
//   } catch (err) {
//     console.error("Weekly error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


 


// // Monthly
// // router.get("/monthly/:userId", async (req, res) => {
// //   try {
// //     const { userId } = req.params;
// //     const now = getISTDate();

// //     const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-01`;
// //     const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-31`;

// //     const data = await FoodEntry.find({
// //       userId,
// //       date: { $gte: start, $lte: end },
// //     }).sort({ date: 1 });

// //     res.json({
// //       count: data.length,
// //       days: data,
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });
// // Monthly (year + month aware, zero-filled, IST-safe)
// // router.get("/monthly/:userId/:year/:month", async (req, res) => {
// //   try {
// //     const { userId, year, month } = req.params;

// //     const y = Number(year);
// //     const m = Number(month); // 1–12

// //     if (m < 1 || m > 12) {
// //       return res.status(400).json({ error: "Invalid month" });
// //     }

// //     const todayIST = getISTDate();
// //     const isCurrentMonth =
// //       y === todayIST.getFullYear() && m === todayIST.getMonth() + 1;

// //     const lastDayOfMonth = new Date(y, m, 0).getDate();
// //     const endDay = isCurrentMonth ? todayIST.getDate() : lastDayOfMonth;

// //     // Fetch existing data
// //     const docs = await FoodEntry.find({
// //       userId,
// //       year: y,
// //       month: m,
// //     }).lean();

// //     // Build map by DAY (not date string)
// //     const map = {};
// //     docs.forEach(d => {
// //       map[d.day] = d;
// //     });

// //     const days = [];

// //     for (let day = 1; day <= endDay; day++) {
// //       if (map[day]) {
// //         days.push({
// //           date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
// //           totals: map[day].totals,
// //           items: map[day].foodItems || [],
// //           message: "Food eaten",
// //         });
// //       } else {
// //         days.push({
// //           date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
// //           totals: {
// //             calories: 0,
// //             protein: 0,
// //             fat: 0,
// //             carbs: 0,
// //             sugar: 0,
// //             calcium: 0,
// //             goodCalories: 0,
// //             badCalories: 0,
// //             avgCalories: 0,
// //           },
// //           items: [],
// //           message: "No food eaten",
// //         });
// //       }
// //     }

// //     res.json({
// //       year: y,
// //       month: m,
// //       daysCount: days.length,
// //       days,
// //     });
// //   } catch (err) {
// //     console.error("Monthly error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // });
// router.get("/monthly/:userId/:year/:month", async (req, res) => {
//   try {
//     const { userId, year, month } = req.params;

//     const y = Number(year);
//     const m = Number(month);

//     if (m < 1 || m > 12) {
//       return res.status(400).json({ error: "Invalid month" });
//     }

//     const todayIST = getISTDate();
//     const isCurrentMonth =
//       y === todayIST.getFullYear() && m === todayIST.getMonth() + 1;

//     const lastDayOfMonth = new Date(y, m, 0).getDate();
//     const endDay = isCurrentMonth ? todayIST.getDate() : lastDayOfMonth;

//     const docs = await FoodEntry.find({
//       userId,
//       year: y,
//       month: m,
//     }).lean();

//     const map = {};
//     docs.forEach(d => {
//       map[d.day] = d;
//     });

//     const totals_range = {
//       calories: 0,
//       protein: 0,
//       fat: 0,
//       carbs: 0,
//       sugar: 0,
//       calcium: 0,
//       goodCalories: 0,
//       badCalories: 0,
//     };

//     let loggedDays = 0;
//     const days = [];

//     for (let day = 1; day <= endDay; day++) {
//       const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

//       if (map[day]) {
//         const t = map[day].totals || {};
//         loggedDays++;

//         totals_range.calories += t.calories || 0;
//         totals_range.protein += t.protein || 0;
//         totals_range.fat += t.fat || 0;
//         totals_range.carbs += t.carbs || 0;
//         totals_range.sugar += t.sugar || 0;
//         totals_range.calcium += t.calcium || 0;
//         totals_range.goodCalories += t.goodCalories || 0;
//         totals_range.badCalories += t.badCalories || 0;

//         days.push({
//           date,
//           totals: t,
//           items: map[day].foodItems || [],
//           message: "Food eaten",
//         });
//       } else {
//         days.push({
//           date,
//           totals: {
//             calories: 0,
//             protein: 0,
//             fat: 0,
//             carbs: 0,
//             sugar: 0,
//             calcium: 0,
//             goodCalories: 0,
//             badCalories: 0,
//           },
//           items: [],
//           message: "No food eaten",
//         });
//       }
//     }

//     const totalDays = days.length;
//     const missedDays = totalDays - loggedDays;

//     // ✅ NEW: averages for monthly
//     const averages = {
//       calories: loggedDays ? Math.round(totals_range.calories / loggedDays) : 0,
//       protein: loggedDays ? +(totals_range.protein / loggedDays).toFixed(1) : 0,
//       fat: loggedDays ? +(totals_range.fat / loggedDays).toFixed(1) : 0,
//       carbs: loggedDays ? +(totals_range.carbs / loggedDays).toFixed(1) : 0,
//       sugar: loggedDays ? +(totals_range.sugar / loggedDays).toFixed(1) : 0,
//       calcium: loggedDays ? +(totals_range.calcium / loggedDays).toFixed(1) : 0,
//       goodCalories: loggedDays
//         ? Math.round(totals_range.goodCalories / loggedDays)
//         : 0,
//       badCalories: loggedDays
//         ? Math.round(totals_range.badCalories / loggedDays)
//         : 0,
//     };

//     res.json({
//       year: y,
//       month: m,
//       totalDays,
//       loggedDays,
//       missedDays,
//       totals_range,
//       averages, // 👈 same as weekly
//       days,
//     });
//   } catch (err) {
//     console.error("Monthly error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });



// router.post("/range", async (req, res) => {
//   try {
//     const { userId, startDate, endDate } = req.body;
//     if (!userId || !startDate || !endDate) {
//       return res.status(400).json({ error: "userId, startDate, endDate required" });
//     }

//     // 1️⃣ Fetch existing data
//     const docs = await FoodEntry.find({
//       userId,
//       date: { $gte: startDate, $lte: endDate },
//     }).lean();

//     // 2️⃣ Build map: date -> doc
//     const map = {};
//     docs.forEach(d => {
//       map[d.date] = d;
//     });

//     // 3️⃣ Generate full date range
//     const results = [];
//     let cursor = new Date(startDate);
//     const end = new Date(endDate);

//     while (cursor <= end) {
//       const y = cursor.getFullYear();
//       const m = String(cursor.getMonth() + 1).padStart(2, "0");
//       const d = String(cursor.getDate()).padStart(2, "0");
//       const iso = `${y}-${m}-${d}`;

//       if (map[iso]) {
//         // existing day
//         results.push({
//           date: iso,
//           totals: map[iso].totals,
//           items: map[iso].foodItems || [],
//           message: "Food eaten",
//         });
//       } else {
//         // missing day → zero
//         results.push({
//           date: iso,
//           totals: {
//             calories: 0,
//             protein: 0,
//             fat: 0,
//             carbs: 0,
//             sugar: 0,
//             calcium: 0,
//             goodCalories: 0,
//             badCalories: 0,
//             avgCalories: 0,
//           },
//           items: [],
//           message: "No food eaten",
//         });
//       }

//       cursor.setDate(cursor.getDate() + 1);
//     }

//     res.json({
//       userId,
//       from: startDate,
//       to: endDate,
//       daysCount: results.length,
//       days: results,
//     });

//   } catch (err) {
//     console.error("Range error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get("/recent/:userId", async (req, res) => {
//   const items = await FoodEntry.aggregate([
//     { $match: { userId: req.params.userId } },
//     { $unwind: "$foodItems" },
//     { $sort: { "foodItems.createdAt": -1 } },
//     { $limit: 10 },
//     { $replaceRoot: { newRoot: "$foodItems" } },
//   ]);

//   res.json({ recent: items });
// });

// // Yearly
// router.get("/yearly/:userId/:year", async (req, res) => {
//   try {
//     const { userId, year } = req.params;

//     const data = await FoodEntry.aggregate([
//       {
//         $match: {
//           userId,
//           year: Number(year),
//         },
//       },
//       {
//         $group: {
//           _id: "$month",
//           calories: { $sum: "$totals.calories" },
//           protein: { $sum: "$totals.protein" },
//           fat: { $sum: "$totals.fat" },
//           carbs: { $sum: "$totals.carbs" },
//         },
//       },
//       { $sort: { _id: 1 } },
//     ]);

//     res.json({
//       year: Number(year),
//       months: data.map((m) => ({
//         month: m._id,
//         calories: m.calories,
//         protein: m.protein,
//         fat: m.fat,
//         carbs: m.carbs,
//       })),
//     });
//   } catch (err) {
//     console.error("Yearly error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });



// module.exports = router;

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");
const router = express.Router();

const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const { generateYesterdayMessage } = require("../services/yesterdayMessageService");

// ===============================
// CONFIG
// ===============================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ===============================
// DATE HELPERS
// ===============================
function getISTDate() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

const clean = (v) => (isNaN(Number(v)) ? 0 : Number(v));

// ===============================
// AI CLIENTS
// ===============================
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================
// SAFE JSON PARSER
// ===============================
function safeJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// ===============================
// AI HELPERS
// ===============================
async function askAIForNutrition(text) {
  const prompt = `
Return ONLY JSON:
{"calories":number,"protein":number,"fat":number,"carbs":number,"sugar":number,"calcium":number}
Food: ${text}
`;

  const r = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "user", content: prompt }],
  });

  return safeJSON(r.choices?.[0]?.message?.content);
}

async function askAIForLabel(text) {
  const prompt = `
Return ONLY JSON:
{"label":"Food name","healthTag":"good_to_have|bad_to_have|average"}
Food: ${text}
`;

  const r = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "user", content: prompt }],
  });

  return safeJSON(r.choices?.[0]?.message?.content);
}

async function askAIForImageNutrition(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath, "base64");

  const prompt = `
Identify food from image.
Assume MINIMUM quantity.
Use USDA/OpenFoodFacts.
Return ONLY JSON:

{
  "name":"Food name",
  "healthTag":"good_to_have|bad_to_have|average",
  "calories":number,
  "protein":number,
  "fat":number,
  "carbs":number,
  "sugar":number,
  "calcium":number
}
`;

  const r = await imageClient.responses.create({
    model: "gpt-5-nano",
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_base64: imageBase64 }
      ],
    }],
  });

  return safeJSON(r.output_text);
}

// ===============================
// ADD FOOD
// ===============================
router.post("/addFood", upload.single("image"), async (req, res) => {
  const { userId, foodData, customText } = req.body;
  const file = req.file;

  try {
    if (!userId) return res.status(400).json({ error: "userId required" });

    // ---- enforce ONE input type ----
    const inputs = [foodData, customText, file].filter(Boolean);
    if (inputs.length !== 1) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Send only ONE of foodData, customText or image" });
    }

    let nutrition, label, name, sourceType;

    // ---------- JSON ----------
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
      label = { label: name, healthTag: data.healthTag || "average" };
      sourceType = "json";
    }

    // ---------- TEXT ----------
    else if (customText) {
      nutrition = await askAIForNutrition(customText);
      label = await askAIForLabel(customText);

      if (!nutrition || !label) {
        throw new Error("AI failed to analyze text");
      }

      name = label.label;
      sourceType = "text";
    }

    // ---------- IMAGE ----------
    else if (file) {
      const imgResult = await askAIForImageNutrition(file.path);

      if (!imgResult) throw new Error("AI failed to analyze image");

      nutrition = {
        calories: clean(imgResult.calories),
        protein: clean(imgResult.protein),
        fat: clean(imgResult.fat),
        carbs: clean(imgResult.carbs),
        sugar: clean(imgResult.sugar),
        calcium: clean(imgResult.calcium),
      };

      name = imgResult.name || "Image Food";
      label = { label: name, healthTag: imgResult.healthTag || "average" };
      sourceType = "image";
    }

    // ---------- CLEANUP IMAGE ----------
    if (file) fs.unlinkSync(file.path);

    const now = getISTDate();
    const date = toISODate(now);

    const foodItem = {
      name,
      label: label.label,
      healthTag: label.healthTag,
      ...nutrition,
      imageUrl: null,
      sourceType,
      createdAt: now,
    };

    const inc = {
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      sugar: nutrition.sugar,
      calcium: nutrition.calcium,
      goodCalories: label.healthTag === "good_to_have" ? nutrition.calories : 0,
      badCalories: label.healthTag === "bad_to_have" ? nutrition.calories : 0,
      avgCalories: label.healthTag === "average" ? nutrition.calories : 0,
    };

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
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

