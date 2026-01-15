console.log("📍 Location routes loaded");

const express = require("express");
const router = express.Router();
const UserLocation = require("../models/UserLocation");

/**
 * POST /api/location
 * Create or update user location
 */
router.post("/location", async (req, res) => {
  try {
    const { userId, location, latitude, longitude } = req.body;

    if (!userId || !location) {
      return res.status(400).json({
        error: "userId and location are required",
      });
    }

    const updated = await UserLocation.findOneAndUpdate(
      { userId },
      {
        location,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
      { upsert: true, new: true }
    );

    return res.json({
      message: "Location saved successfully",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Save location error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/location/:userId
 * Fetch user location
 */
router.get("/location/:userId", async (req, res) => {
  try {
    const data = await UserLocation.findOne({
      userId: req.params.userId,
    });

    if (!data) {
      return res.status(404).json({
        message: "Location not found",
        location: null,
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("❌ Get location error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
