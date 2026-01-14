console.log("🔥 FCM ROUTES REGISTERED 🔥");

const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");

/**
 * POST /api/updateFcmToken
 * Body examples:
 * {
 *   "userId": "123",
 *   "fcmToken": "FCM_TOKEN",
 *   "location": "Bangalore"
 * }
 *
 * {
 *   "userId": "123",
 *   "location": "Delhi"
 * }
 *
 * {
 *   "userId": "123"
 * }
 */
router.post("/updateFcmToken", async (req, res) => {
  try {
    const { userId, fcmToken, location } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    let updated = false;
    let messages = [];

    // ---------- Handle FCM token ----------
    if (fcmToken) {
      if (!Array.isArray(profile.fcmTokens)) {
        profile.fcmTokens = [];
      }

      if (!profile.fcmTokens.includes(fcmToken)) {
        profile.fcmTokens.push(fcmToken);
        updated = true;
        messages.push("FCM token added");
      } else {
        messages.push("FCM token already exists");
      }
    } else {
      messages.push("FCM token not provided, skipped");
    }

    // ---------- Handle location ----------
    if (location && typeof location === "string") {
      profile.location = location;
      updated = true;
      messages.push("Location updated");
    } else if (location === null) {
      messages.push("Location is null, skipped");
    }

    if (updated) {
      await profile.save();
    }

    return res.json({
      message: messages.join(" | "),
      fcmTokens: profile.fcmTokens,
      location: profile.location || null,
    });
  } catch (err) {
    console.error("❌ updateFcmToken error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/logout
 * Body:
 * {
 *   "userId": "123",
 *   "fcmToken": "FCM_TOKEN"
 * }
 */
router.post("/logout", async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        error: "userId and fcmToken required",
      });
    }

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    profile.fcmTokens = (profile.fcmTokens || []).filter(
      (t) => t !== fcmToken
    );

    await profile.save();

    return res.json({
      message: "Logged out successfully",
      fcmTokens: profile.fcmTokens,
    });
  } catch (err) {
    console.error("❌ logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/location/:userId
 */
router.get("/location/:userId", async (req, res) => {
  try {
    const profile = await UserProfile.findOne({
      userId: req.params.userId,
    }).select("location");

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      userId: req.params.userId,
      location: profile.location || null,
    });
  } catch (err) {
    console.error("❌ get location error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
