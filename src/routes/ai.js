<<<<<<< HEAD
// const express = require("express");
// const router = express.Router();
// const OpenAI = require("openai");
// const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY });

// router.post("/talkToAI", async (req, res) => {
//   try {
//     const { prompt } = req.body;
//     const response = await client.chat.completions.create({
//       model: "llama3-8b-8192",
//       messages: [{ role: "user", content: prompt }],
//     });
//     res.json({ reply: response.choices[0].message.content });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
console.log("✅ AI routes loaded!");

const express = require("express");
const router = express.Router();
const OpenAI = require("openai"); // Groq AI uses OpenAI SDK

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Use Groq AI API key
  baseURL: "https://api.groq.com/openai/v1", // Groq AI base URL
});

// Keywords to check if it's food/diet related
const foodKeywords = [
  "food",
  "calorie",
  "diet",
  "nutrition",
  "protein",
  "carbs",
  "fat",
  "meal",
  "fitness",
  "weight",
  "muscle",
  "exercise",
  "weight loss",
  "weight gain",
  "healthy eating",
  "vitamins",
  "minerals",
  "hydration",
  "snacks",
  "breakfast",
  "lunch",
  "dinner",
  "veggies",
  "fruits",
  "workout",
  "training",
  "endurance",
  "strength",
  "cardio",
  "wellness",
  "lifestyle",
  "supplements",
  "meal plan",
  "portion size",
  "dietary restrictions",
  "allergies",
  "gluten-free",
  "vegan",
  "vegetarian",
  "keto",
  "paleo",
  "intermittent fasting",
  "macros",
  "micros",
  "bodybuilding",
  "fitness goals",
  "physical activity",
  "rest days",
  "recovery",
  "metabolism",
  "caloric intake",
  "healthy fats",
  "sugars",
  "fiber",
  "cholesterol",
  "blood pressure",
  "diabetes",
  "heart health",
  "mental health",
  "stress management",
  "sleep quality",
  "hydration",
  "water intake",
  "immune system",
  "antioxidants",
  "Thanksgiving",
  "Thank you",
];

router.post("/talkToAI", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Check if prompt is related to food/diet
    const lowerPrompt = prompt.toLowerCase();
    const isFoodQuery = foodKeywords.some((keyword) =>
      lowerPrompt.includes(keyword)
    );

    if (!isFoodQuery) {
      return res.json({
        response:
          "😅 Sorry, I can’t answer that — but let’s stick to food, calories & diet plans 🥗💪",
      });
    }

    // Call Groq AI
    try {
      const response = await client.responses.create({
        model: "openai/gpt-oss-20b", // Groq AI model
        input: [
          {
            role: "system",
            content:
              "You are a diet and fitness assistant. Only give answers related to food, calories, diet, nutrition, and fitness. Do not answer unrelated topics.",
          },
          { role: "user", content: prompt },
        ],
      });

      return res.json({ response: response.output_text });
    } catch (groqError) {
      console.error("Groq API Error:", groqError);

      // Handle quota exceeded or rate limit
      if (groqError.code === "insufficient_quota" || groqError.status === 429) {
        return res.json({
          response:
            "⚠️ My brain needs some rest (quota exceeded). But here’s a quick tip: eat balanced meals with protein, carbs, and veggies 🥦🍗🍚",
        });
      }

      // Generic fallback
      return res.json({
        response:
          "⚠️ Oops, something went wrong with the AI service. Please try again later!",
      });
    }
  } catch (error) {
    console.error("AI Route Error:", error);
    res.status(500).json({ error: "Unexpected error in AI route" });
  }
});

module.exports = router;
=======
// const express = require("express");
// const router = express.Router();
// const OpenAI = require("openai");
// const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY });

// router.post("/talkToAI", async (req, res) => {
//   try {
//     const { prompt } = req.body;
//     const response = await client.chat.completions.create({
//       model: "llama3-8b-8192",
//       messages: [{ role: "user", content: prompt }],
//     });
//     res.json({ reply: response.choices[0].message.content });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
console.log("✅ AI routes loaded!");

const express = require("express");
const router = express.Router();
const OpenAI = require("openai"); // Groq AI uses OpenAI SDK

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Use Groq AI API key
  baseURL: "https://api.groq.com/openai/v1", // Groq AI base URL
});

// Keywords to check if it's food/diet related
const foodKeywords = [
  "food",
  "calorie",
  "diet",
  "nutrition",
  "protein",
  "carbs",
  "fat",
  "meal",
  "fitness",
  "weight",
  "muscle",
  "exercise",
  "weight loss",
  "weight gain",
  "healthy eating",
  "vitamins",
  "minerals",
  "hydration",
  "snacks",
  "breakfast",
  "lunch",
  "dinner",
  "veggies",
  "fruits",
  "workout",
  "training",
  "endurance",
  "strength",
  "cardio",
  "wellness",
  "lifestyle",
  "supplements",
  "meal plan",
  "portion size",
  "dietary restrictions",
  "allergies",
  "gluten-free",
  "vegan",
  "vegetarian",
  "keto",
  "paleo",
  "intermittent fasting",
  "macros",
  "micros",
  "bodybuilding",
  "fitness goals",
  "physical activity",
  "rest days",
  "recovery",
  "metabolism",
  "caloric intake",
  "healthy fats",
  "sugars",
  "fiber",
  "cholesterol",
  "blood pressure",
  "diabetes",
  "heart health",
  "mental health",
  "stress management",
  "sleep quality",
  "hydration",
  "water intake",
  "immune system",
  "antioxidants",
  "Thanksgiving",
  "Thank you",
];

router.post("/talkToAI", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Check if prompt is related to food/diet
    const lowerPrompt = prompt.toLowerCase();
    const isFoodQuery = foodKeywords.some((keyword) =>
      lowerPrompt.includes(keyword)
    );

    if (!isFoodQuery) {
      return res.json({
        response:
          "😅 Sorry, I can’t answer that — but let’s stick to food, calories & diet plans 🥗💪",
      });
    }

    // Call Groq AI
    try {
      const response = await client.responses.create({
        model: "openai/gpt-oss-20b", // Groq AI model
        input: [
          {
            role: "system",
            content:
              "You are a diet and fitness assistant. Only give answers related to food, calories, diet, nutrition, and fitness. Do not answer unrelated topics.",
          },
          { role: "user", content: prompt },
        ],
      });

      return res.json({ response: response.output_text });
    } catch (groqError) {
      console.error("Groq API Error:", groqError);

      // Handle quota exceeded or rate limit
      if (groqError.code === "insufficient_quota" || groqError.status === 429) {
        return res.json({
          response:
            "⚠️ My brain needs some rest (quota exceeded). But here’s a quick tip: eat balanced meals with protein, carbs, and veggies 🥦🍗🍚",
        });
      }

      // Generic fallback
      return res.json({
        response:
          "⚠️ Oops, something went wrong with the AI service. Please try again later!",
      });
    }
  } catch (error) {
    console.error("AI Route Error:", error);
    res.status(500).json({ error: "Unexpected error in AI route" });
  }
});

module.exports = router;
>>>>>>> 144b3b460fbdfcb1fe8ce0688ced89453835d895
