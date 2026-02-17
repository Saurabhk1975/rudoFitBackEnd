console.log("✅ Profile routes loaded!");

const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");
const OpenAI = require("openai");
const DeleteAccountRequest = require("../models/DeleteAccountRequest");
const Feedback = require("../models/Feedback");

// 🧠 Setup Groq AI client
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// =======================================
// 🔢 ADD: Surplus / Deficit Calculator
// =======================================
const calculateSurplusDeficit = ({
  goal,
  weight,
  targetCalories,
  targetProtein,
}) => {
  let caloriesSurplus = 0;
  let caloriesDeficit = 0;
  let proteinSurplus = 0;
  let proteinDeficit = 0;

  // Calories WHO Safe Range
  if (goal === "lose") {
    caloriesDeficit = Math.min(500, Math.max(300, Math.round(targetCalories * 0.2)));
  } else if (goal === "gain") {
    caloriesSurplus = Math.min(500, Math.max(300, Math.round(targetCalories * 0.15)));
  }

  // Protein WHO / ICMR
  const maintenanceProtein = weight * 0.8;
  const optimalProtein =
    goal === "lose" || goal === "gain" ? weight * 1.4 : weight * 1.0;

  if (targetProtein > optimalProtein) {
    proteinSurplus = +(targetProtein - optimalProtein).toFixed(1);
  } else if (targetProtein < maintenanceProtein) {
    proteinDeficit = +(maintenanceProtein - targetProtein).toFixed(1);
  }

  return {
    caloriesSurplus,
    caloriesDeficit,
    proteinSurplus,
    proteinDeficit,
  };
};

// =======================================
// 🔹 AI Target Calculator (UNCHANGED)
// =======================================
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
            "You are a nutrition and fitness assistant. Respond only with valid JSON containing keys: calories, protein, fat, carb. Do not include any text outside JSON. and alway assume minimu portion and try to be efficient and alway think and try to be 99.9% accurate and if you are not sure about portion take lowest as lowest as you can assume like standard quantity and then respond and also take take reference of WHO or US food database",
        },
        { role: "user", content: userPrompt },
      ],
    });

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

// =======================================
// 🔹 Profile completeness check (UNCHANGED)
// =======================================
const areAllFieldsComplete = (data) => {
  const requiredFields = [
    "userId",
    "name",
    "mobileNumber",
    "age",
    "gender",
    "weight",
    "height",
    "weightUnit",
    "heightUnit",
    "targetWeight",
    "goal",
    "physicalActivity",
  ];

  return requiredFields.every((field) => {
    const value = data[field];
    return value !== null && value !== undefined && value !== "";
  });
};

// =======================================
// 🧩 CREATE / UPDATE PROFILE
// =======================================
router.post("/createProfile", async (req, res) => {
  try {
    const data = req.body;

    const existing = await UserProfile.findOne({ userId: data.userId });

    // 🔹 AI TARGETS
    const targets = await getAICalculatedTargets(data);

    // 🔥 ADD Surplus/Deficit
    const surplusDeficit = calculateSurplusDeficit({
      goal: data.goal,
      weight: data.weight,
      targetCalories: targets.calories,
      targetProtein: targets.protein,
    });

    const allFieldsComplete = areAllFieldsComplete(data);

    const updatedData = {
      ...data,

      // AI Targets
      targetCalorie: targets.calories,
      targetProtein: targets.protein,
      targetFat: targets.fat,
      targetCarb: targets.carb,

      // ➕➖ NEW FIELDS
      caloriesSurplus: surplusDeficit.caloriesSurplus,
      caloriesDeficit: surplusDeficit.caloriesDeficit,
      proteinSurplus: surplusDeficit.proteinSurplus,
      proteinDeficit: surplusDeficit.proteinDeficit,

      showRegistered: allFieldsComplete ? true : false,
    };

    let profile;

    if (existing) {
      profile = await UserProfile.findOneAndUpdate(
        { userId: data.userId },
        updatedData,
        { new: true }
      );

      return res.json({
        message: "♻️ Profile updated successfully",
        profile,
      });
    } else {
      profile = new UserProfile(updatedData);
      await profile.save();

      return res.json({
        message: "✅ Profile created successfully",
        profile,
      });
    }
  } catch (err) {
    console.error("❌ Create/Update Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================================
// 🧩 GET PROFILE
// =======================================
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

// =======================================
// 🧩 EDIT PROFILE (AI RECALC ALWAYS)
// =======================================
router.put("/editProfile/:userId", async (req, res) => {
  try {
    const data = req.body;

    // 🔹 AI recalculation
    const targets = await getAICalculatedTargets(data);

    // 🔥 Surplus/Deficit recalculation
    const surplusDeficit = calculateSurplusDeficit({
      goal: data.goal,
      weight: data.weight,
      targetCalories: targets.calories,
      targetProtein: targets.protein,
    });

    const updated = await UserProfile.findOneAndUpdate(
      { userId: req.params.userId },
      {
        ...data,

        targetCalorie: targets.calories,
        targetProtein: targets.protein,
        targetFat: targets.fat,
        targetCarb: targets.carb,

        caloriesSurplus: surplusDeficit.caloriesSurplus,
        caloriesDeficit: surplusDeficit.caloriesDeficit,
        proteinSurplus: surplusDeficit.proteinSurplus,
        proteinDeficit: surplusDeficit.proteinDeficit,
      },
      { new: true, upsert: true }
    );

    res.json({ message: "✅ Profile updated successfully", updated });
  } catch (err) {
    console.error("❌ Edit Profile Error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/deleteAccount", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // prevent duplicate requests
    const existing = await DeleteAccountRequest.findOne({
      userId,
      status: "pending",
    });

    if (existing) {
      return res.json({
        message: "Delete account request already submitted",
      });
    }

    const request = new DeleteAccountRequest({
      userId,
      reason: reason || "",
    });

    await request.save();

    res.json({
      message: "Delete account request submitted successfully",
    });
  } catch (err) {
    console.error("❌ Delete Account Error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/feedback", async (req, res) => {
  try {
    const { userId, name, email, mobileNumber, message } = req.body;

    if (!userId || !name || !email || !mobileNumber || !message) {
      return res.status(400).json({
        error: "userId, name, email, mobileNumber, message are required",
      });
    }

    const feedback = new Feedback({
      userId,
      name,
      email,
      mobileNumber,
      message,
    });

    await feedback.save();

    res.json({
      message: "Feedback submitted successfully",
    });
  } catch (err) {
    console.error("❌ Feedback Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;







// console.log("✅ Profile routes loaded!");

// const express = require("express");
// const router = express.Router();
// const UserProfile = require("../models/UserProfile");
// const OpenAI = require("openai");

// // 🧠 Setup Groq AI client (same as ai.js)
// const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1", // Groq base URL
// });

// // 🔹 Helper: Ask AI to calculate target values
// const getAICalculatedTargets = async (profileData) => {
//   try {
//     const userPrompt = `
//     Based on the following user details:
//     Age: ${profileData.age}, Gender: ${profileData.gender},
//     Height: ${profileData.height}${profileData.heightUnit},
//     Weight: ${profileData.weight}${profileData.weightUnit},
//     Goal: ${profileData.goal},
//     Physical Activity: ${profileData.physicalActivity}.
//     Provide realistic daily target nutrition values (calories, protein, fat, carb)
//     in valid JSON format ONLY like:
//     {"calories":2200,"protein":120,"fat":70,"carb":250}
//     `;

//     const response = await client.responses.create({
//       model: "openai/gpt-oss-20b",
//       input: [
//         {
//           role: "system",
//           content:
//             "You are a nutrition and fitness assistant. Respond only with valid JSON containing keys: calories, protein, fat, carb. Do not include any text outside JSON.",
//         },
//         { role: "user", content: userPrompt },
//       ],
//     });

//     // Try parsing AI JSON
//     try {
//       const aiOutput = JSON.parse(response.output_text);
//       return aiOutput;
//     } catch (err) {
//       console.error("⚠️ Failed to parse AI JSON:", err);
//       return { calories: 0, protein: 0, fat: 0, carb: 0 };
//     }
//   } catch (error) {
//     console.error("⚠️ Groq AI error:", error);
//     return { calories: 0, protein: 0, fat: 0, carb: 0 };
//   }
// };

// // 🔹 Helper: Check if all profile fields are complete (no null/undefined)
// const areAllFieldsComplete = (data) => {
//   const requiredFields = [
//     'userId', 'name', 'mobileNumber', 'age', 'gender', 
//     'weight', 'height', 'weightUnit', 'heightUnit', 
//     'targetWeight', 'goal', 'physicalActivity'
//   ];
  
//   return requiredFields.every(field => {
//     const value = data[field];
//     return value !== null && value !== undefined && value !== '';
//   });
// };

// // 🧩 POST /createProfile
// router.post("/createProfile", async (req, res) => {
//   try {
//     const data = req.body;

//     // Check if profile already exists for this userId
//     const existing = await UserProfile.findOne({ userId: data.userId });

//     // Get AI-calculated target values
//     const targets = await getAICalculatedTargets(data);

//     // Check if all fields are complete and set showRegistered accordingly
//     const allFieldsComplete = areAllFieldsComplete(data);

//     const updatedData = {
//       ...data,
//       targetCalorie: targets.calories,
//       targetProtein: targets.protein,
//       targetFat: targets.fat,
//       targetCarb: targets.carb,
//       showRegistered: allFieldsComplete ? false : true,
//     };

//     let profile;

//     if (existing) {
//       // 👉 Update existing profile
//       profile = await UserProfile.findOneAndUpdate(
//         { userId: data.userId },
//         updatedData,
//         { new: true }
//       );
//       return res.json({
//         message: "♻️ Profile updated successfully",
//         profile,
//       });
//     } else {
//       // 👉 Create new profile
//       profile = new UserProfile(updatedData);
//       await profile.save();
//       return res.json({
//         message: "✅ Profile created successfully",
//         profile,
//       });
//     }
//   } catch (err) {
//     console.error("❌ Create/Update Profile Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });






// // router.post("/createProfile", async (req, res) => {
// //   try {
// //     const data = req.body;

// //     // Get AI-calculated target values
// //     const targets = await getAICalculatedTargets(data);

// //     const profile = new UserProfile({
// //       ...data,
// //       targetCalorie: targets.calories,
// //       targetProtein: targets.protein,
// //       targetFat: targets.fat,
// //       targetCarb: targets.carb,
// //     });

// //     await profile.save();
// //     res.json({ message: "✅ Profile created successfully", profile });
// //   } catch (err) {
// //     console.error("❌ Create Profile Error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // 🧩 GET /profile/:userId
// router.get("/profile/:userId", async (req, res) => {
//   try {
//     const profile = await UserProfile.findOne({ userId: req.params.userId });
//     if (!profile)
//       return res.status(404).json({ message: "Profile not found for this user" });
//     res.json(profile);
//   } catch (err) {
//     console.error("❌ Get Profile Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // 🧩 PUT /editProfile/:userId
// router.put("/editProfile/:userId", async (req, res) => {
//   try {
//     const data = req.body;

//     // Recalculate AI target values
//     const targets = await getAICalculatedTargets(data);

//     const updated = await UserProfile.findOneAndUpdate(
//       { userId: req.params.userId },
//       {
//         ...data,
//         targetCalorie: targets.calories,
//         targetProtein: targets.protein,
//         targetFat: targets.fat,
//         targetCarb: targets.carb,
//       },
//       { new: true, upsert: true }
//     );

//     res.json({ message: "✅ Profile updated successfully", updated });
//   } catch (err) {
//     console.error("❌ Edit Profile Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
