console.log("📍 Location routes loaded");

const express = require("express");
const router = express.Router();
const UserLocation = require("../models/UserLocation");

/**
 * POST /api/location
 * Handles null location safely
 */
router.post("/location", async (req, res) => {
  try {
    const { userId, location, latitude, longitude } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    // Explicit null handling (permission denied case)
    const payload = {
      location: location ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    };

    const updated = await UserLocation.findOneAndUpdate(
      { userId },
      payload,
      { upsert: true, new: true }
    );

    return res.json({
      message:
        location === null
          ? "Location permission denied, saved as null"
          : "Location saved successfully",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Save location error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/location/:userId
 */
router.get("/location/:userId", async (req, res) => {
  try {
    const data = await UserLocation.findOne({
      userId: req.params.userId,
    });

    if (!data) {
      return res.json({
        userId: req.params.userId,
        location: null,
        latitude: null,
        longitude: null,
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("❌ Get location error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
