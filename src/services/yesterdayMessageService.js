// src/services/yesterdayMessageService.js
const OpenAI = require("openai");
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const YesterdayMessage = require("../models/Yesterday_Message");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ---------------- IST DATE HELPERS ----------------
const getISTDateString = (date = new Date()) => {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getDate()}/${ist.getMonth() + 1}/${ist.getFullYear()}`;
};

// -------------------------------------------------
async function generateYesterdayMessage(userId) {
  console.log("🟡 generateYesterdayMessage started for:", userId);

  // 1️⃣ PROFILE MUST EXIST
  const profile = await UserProfile.findOne({ userId }).lean();
  if (!profile) {
    console.log("🔴 No profile found, aborting");
    return;
  }

  // 2️⃣ YESTERDAY DATE
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getISTDateString(yesterday);

  // 3️⃣ FIND OR CREATE MESSAGE DOC
  let msgDoc = await YesterdayMessage.findOne({ userId });

  if (!msgDoc) {
    msgDoc = await YesterdayMessage.create({
      userId,
      forDate: yesterdayStr,
      isPending: true,
      message: null,
    });
    console.log("🟡 YesterdayMessage document created");
  }

  // 4️⃣ PREVENT DUPLICATE GENERATION
  if (msgDoc.isPending === false) {
    console.log("🟢 Message already generated, skipping");
    return;
  }

  // 5️⃣ FETCH YESTERDAY FOOD
  const foodDoc = await FoodEntry.findOne({ userId }).lean();
  let yesterdayFoods = [];

  if (foodDoc?.nutritionByDate?.length) {
    foodDoc.nutritionByDate.forEach((y) => {
      y.months.forEach((m) => {
        m.days.forEach((d) => {
          const dateStr = `${d.day}/${m.month}/${y.year}`;
          if (dateStr === yesterdayStr) {
            yesterdayFoods = d.foodItems || [];
          }
        });
      });
    });
  }

  // 🔒 NO FOOD → NO AI CALL
  if (!yesterdayFoods.length) {
    console.log("🟡 No food logged yesterday, skipping AI");
    msgDoc.isPending = false;
    msgDoc.message = null;
    await msgDoc.save();
    return;
  }

  // 6️⃣ AI INPUT
  const aiInput = {
    user: {
      name: profile.name || "User",
      age: profile.age,
      gender: profile.gender,
      weight: profile.weight,
      height: profile.height,
      goal: profile.goal,
      activity: profile.physicalActivity,
      targets: {
        calories: profile.targetCalorie,
        protein: profile.targetProtein,
        fat: profile.targetFat,
        carb: profile.targetCarb,
      },
    },
    yesterdayFood: yesterdayFoods,
  };

  const prompt = `
You are a friendly fitness coach.
Generate ONE short personalized message.
Use user's name.
Analyse yesterday food briefly.
Encourage improvement.
Max 2–3 lines.
Return ONLY plain text.
`;

  // 7️⃣ CALL AI (SAFE PARSING)
  let aiText = null;

  try {
    const aiResp = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(aiInput) },
      ],
    });

    aiText = aiResp?.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error("❌ AI call failed:", err.message);
  }

  if (!aiText) {
    console.log("🔴 AI returned empty message");
    msgDoc.isPending = false;
    msgDoc.message = null;
    await msgDoc.save();
    return;
  }

  // 8️⃣ SAVE MESSAGE
  msgDoc.message = aiText;
  msgDoc.forDate = yesterdayStr;
  msgDoc.isPending = false;

  await msgDoc.save();

  console.log("🟢 Yesterday message saved successfully");
}

module.exports = { generateYesterdayMessage };
