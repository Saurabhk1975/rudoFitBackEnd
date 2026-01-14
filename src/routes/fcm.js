console.log("fcm_file_loaded ....");

const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");

/**
 * POST /api/updateFcmToken
 * body: { userId, fcmToken, location? }
 */
router.post("/updateFcmToken", async (req, res) => {
  try {
    const { userId, fcmToken, location } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        error: "userId and fcmToken required",
      });
    }

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ Add FCM token only if not already present
    if (!profile.fcmTokens.includes(fcmToken)) {
      profile.fcmTokens.push(fcmToken);
    }

    // ✅ Update location ONLY if provided
    if (location && typeof location === "string") {
      profile.location = location;
    }

    await profile.save();

    return res.json({
      message: "FCM token updated successfully",
      location: profile.location || null,
      fcmTokens: profile.fcmTokens,
    });
  } catch (err) {
    console.error("FCM update error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/logout
 * body: { userId, fcmToken }
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

    profile.fcmTokens = profile.fcmTokens.filter(
      (token) => token !== fcmToken
    );

    await profile.save();

    return res.json({
      message: "Logged out successfully",
      fcmTokens: profile.fcmTokens,
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/userLocation/:userId
 */
router.get("/userLocation/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await UserProfile.findOne(
      { userId },
      { location: 1, _id: 0 }
    );

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      userId,
      location: profile.location || null,
    });
  } catch (err) {
    console.error("Get location error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
