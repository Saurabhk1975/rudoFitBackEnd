<<<<<<< HEAD
console.log("✅ Profile routes loaded!");

const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");

// 🧠 Setup Groq AI client (same as ai.js)
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", // Groq base URL
});

// 🔹 Helper: Ask AI to calculate target values
const getAICalculatedTargets = async (profileData) => {
  try {
    const userPrompt = `
    Based on the following user details:
    Age: ${profileData.age}, Gender: ${profileData.gender},
    Height: ${profileData.height}${profileData.heightUnit},
    Weight: ${profileData.weight}${profileData.weightUnit},
    Goal: ${profileData.goal},
    Physical Activity: ${profileData.physicalActivity}.
    Provide realistic daily target nutrition values (calories, protein, fat, carb)
    in valid JSON format ONLY like:
    {"calories":2200,"protein":120,"fat":70,"carb":250}
    `;

    const response = await client.responses.create({
      model: "openai/gpt-oss-20b",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition and fitness assistant. Respond only with valid JSON containing keys: calories, protein, fat, carb. Do not include any text outside JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    // Try parsing AI JSON
    try {
      const aiOutput = JSON.parse(response.output_text);
      return aiOutput;
    } catch (err) {
      console.error("⚠️ Failed to parse AI JSON:", err);
      return { calories: 0, protein: 0, fat: 0, carb: 0 };
    }
  } catch (error) {
    console.error("⚠️ Groq AI error:", error);
    return { calories: 0, protein: 0, fat: 0, carb: 0 };
  }
};

// 🧩 POST /createProfile
router.post("/createProfile", async (req, res) => {
  try {
    const data = req.body;

    // Get AI-calculated target values
    const targets = await getAICalculatedTargets(data);

    const profile = new UserProfile({
      ...data,
      targetCalorie: targets.calories,
      targetProtein: targets.protein,
      targetFat: targets.fat,
      targetCarb: targets.carb,
    });

    await profile.save();
    res.json({ message: "✅ Profile created successfully", profile });
  } catch (err) {
    console.error("❌ Create Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧩 GET /profile/:userId
router.get("/profile/:userId", async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.params.userId });
    if (!profile)
      return res.status(404).json({ message: "Profile not found for this user" });
    res.json(profile);
  } catch (err) {
    console.error("❌ Get Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧩 PUT /editProfile/:userId
router.put("/editProfile/:userId", async (req, res) => {
  try {
    const data = req.body;

    // Recalculate AI target values
    const targets = await getAICalculatedTargets(data);

    const updated = await UserProfile.findOneAndUpdate(
      { userId: req.params.userId },
      {
        ...data,
        targetCalorie: targets.calories,
        targetProtein: targets.protein,
        targetFat: targets.fat,
        targetCarb: targets.carb,
      },
      { new: true, upsert: true }
    );

    res.json({ message: "✅ Profile updated successfully", updated });
  } catch (err) {
    console.error("❌ Edit Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
=======
console.log("✅ Profile routes loaded!");

const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");

// 🧠 Setup Groq AI client (same as ai.js)
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", // Groq base URL
});

// 🔹 Helper: Ask AI to calculate target values
const getAICalculatedTargets = async (profileData) => {
  try {
    const userPrompt = `
    Based on the following user details:
    Age: ${profileData.age}, Gender: ${profileData.gender},
    Height: ${profileData.height}${profileData.heightUnit},
    Weight: ${profileData.weight}${profileData.weightUnit},
    Goal: ${profileData.goal},
    Physical Activity: ${profileData.physicalActivity}.
    Provide realistic daily target nutrition values (calories, protein, fat, carb)
    in valid JSON format ONLY like:
    {"calories":2200,"protein":120,"fat":70,"carb":250}
    `;

    const response = await client.responses.create({
      model: "openai/gpt-oss-20b",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition and fitness assistant. Respond only with valid JSON containing keys: calories, protein, fat, carb. Do not include any text outside JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    // Try parsing AI JSON
    try {
      const aiOutput = JSON.parse(response.output_text);
      return aiOutput;
    } catch (err) {
      console.error("⚠️ Failed to parse AI JSON:", err);
      return { calories: 0, protein: 0, fat: 0, carb: 0 };
    }
  } catch (error) {
    console.error("⚠️ Groq AI error:", error);
    return { calories: 0, protein: 0, fat: 0, carb: 0 };
  }
};

// 🧩 POST /createProfile
router.post("/createProfile", async (req, res) => {
  try {
    const data = req.body;

    // Get AI-calculated target values
    const targets = await getAICalculatedTargets(data);

    const profile = new UserProfile({
      ...data,
      targetCalorie: targets.calories,
      targetProtein: targets.protein,
      targetFat: targets.fat,
      targetCarb: targets.carb,
    });

    await profile.save();
    res.json({ message: "✅ Profile created successfully", profile });
  } catch (err) {
    console.error("❌ Create Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧩 GET /profile/:userId
router.get("/profile/:userId", async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.params.userId });
    if (!profile)
      return res.status(404).json({ message: "Profile not found for this user" });
    res.json(profile);
  } catch (err) {
    console.error("❌ Get Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧩 PUT /editProfile/:userId
router.put("/editProfile/:userId", async (req, res) => {
  try {
    const data = req.body;

    // Recalculate AI target values
    const targets = await getAICalculatedTargets(data);

    const updated = await UserProfile.findOneAndUpdate(
      { userId: req.params.userId },
      {
        ...data,
        targetCalorie: targets.calories,
        targetProtein: targets.protein,
        targetFat: targets.fat,
        targetCarb: targets.carb,
      },
      { new: true, upsert: true }
    );

    res.json({ message: "✅ Profile updated successfully", updated });
  } catch (err) {
    console.error("❌ Edit Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
>>>>>>> 144b3b460fbdfcb1fe8ce0688ced89453835d895
