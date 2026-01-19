// src/services/yesterdayMessageService.js
const OpenAI = require("openai");
const FoodEntry = require("../models/FoodEntry");
const UserProfile = require("../models/UserProfile");
const YesterdayMessage = require("../models/Yesterday_Message");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// IST helper
const getISTDateString = (date = new Date()) => {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getDate()}/${ist.getMonth() + 1}/${ist.getFullYear()}`;
};

async function generateYesterdayMessage(userId) {
  // 🔒 SAFETY: profile must exist
  const profile = await UserProfile.findOne({ userId });
  if (!profile) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getISTDateString(yesterday);

  // 🔒 Prevent duplicate generation
  let msgDoc = await YesterdayMessage.findOne({ userId });
  if (!msgDoc) {
    msgDoc = await YesterdayMessage.create({
      userId,
      forDate: yesterdayStr,
      isPending: true,
    });
  }

  if (!msgDoc.isPending) return;

  // 🔍 Fetch yesterday food data
  const food = await FoodEntry.findOne({ userId });
  let yesterdayFoods = [];

  if (food) {
    food.nutritionByDate.forEach((y) => {
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

  // AI INPUT JSON
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
You are a fitness coach.
Generate ONE short friendly personalized message.
Mention user's name.
Analyse yesterday food.
Encourage improvement.
Return ONLY text.`;

  const aiResp = await client.responses.create({
    model: "openai/gpt-oss-20b",
    input: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(aiInput) },
    ],
  });

  msgDoc.message = aiResp.output_text || "";
  msgDoc.isPending = false;
  msgDoc.forDate = yesterdayStr;

  await msgDoc.save();
}

module.exports = { generateYesterdayMessage };
