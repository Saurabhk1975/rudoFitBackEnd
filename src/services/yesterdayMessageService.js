// src/services/yesterdayMessageService.js
const OpenAI = require("openai");
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const YesterdayMessage = require("../models/Yesterday_Message");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// IST YYYY-MM-DD
function getYesterdayISO() {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  d.setDate(d.getDate() - 1);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

async function generateYesterdayMessage(userId) {
  try {
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return;

    const date = getYesterdayISO();

    // 🔒 ensure single doc per day
    let msgDoc = await YesterdayMessage.findOne({ userId, date });

    if (!msgDoc) {
      msgDoc = await YesterdayMessage.create({
        userId,
        date,           // ✅ FIX
        isUpdated: true,
      });
    }

    if (msgDoc.isUpdated === false) return;

    // 🔍 Fetch yesterday food
    const food = await FoodEntry.findOne({ userId, date }).lean();
    const yesterdayFoods = food?.foodItems || [];

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
Generate ONE short friendly personalized message.
Mention user's name.
Analyse yesterday food.
Encourage improvement.
Return ONLY plain text.
`;

    const aiResp = await client.responses.create({
      model: "openai/gpt-oss-20b",
      input: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(aiInput) },
      ],
    });

    msgDoc.message = aiResp.output_text || "";
    msgDoc.isUpdated = false;

    await msgDoc.save();
  } catch (err) {
    console.error("❌ generateYesterdayMessage failed:", err.message);
  }
}

module.exports = { generateYesterdayMessage };
