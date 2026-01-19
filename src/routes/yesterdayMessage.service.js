// src/services/yesterdayMessage.service.js
const YesterdayMessage = require("../models/Yesterday_Message");
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// IST date helper
const getISTDateString = (offsetDays = 0) => {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  now.setDate(now.getDate() - offsetDays);
  return now.toISOString().split("T")[0];
};

async function generateYesterdayMessage(userId) {
  try {
    const yesterday = getISTDateString(1);

    // 🔹 Check existing record
    let record = await YesterdayMessage.findOne({ userId, date: yesterday });

    if (record && record.isUpdated === false) return;

    // 🔹 Fetch user profile
    const profile = await UserProfile.findOne({ userId });
    if (!profile) return;

    // 🔹 Fetch yesterday food logs
    const foodDoc = await FoodEntry.findOne({ userId });
    if (!foodDoc) return;

    const y = parseInt(yesterday.split("-")[0]);
    const m = parseInt(yesterday.split("-")[1]);
    const d = parseInt(yesterday.split("-")[2]);

    const year = foodDoc.nutritionByDate.find((x) => x.year === y);
    const month = year?.months.find((x) => x.month === m);
    const day = month?.days.find((x) => x.day === d);

    const foodItems = day?.foodItems || [];

    // 🔹 AI Prompt
    const prompt = `
You are a nutrition coach.

User profile:
${JSON.stringify(
  {
    name: profile.name,
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
  null,
  2
)}

Yesterday food logs:
${JSON.stringify(foodItems, null, 2)}

Task:
Write a short, friendly, personalized message using user's name.
Be honest, motivating, and practical.
No emojis. Max 4 lines.
`;

    const aiRes = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
    });

    const message = aiRes.choices[0].message.content.trim();

    // 🔹 Save / Update
    await YesterdayMessage.findOneAndUpdate(
      { userId, date: yesterday },
      {
        userId,
        date: yesterday,
        message,
        isUpdated: false,
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("Yesterday AI error:", err.message);
  }
}

module.exports = { generateYesterdayMessage };
