// src/routes/yesterdayMessage.js
const express = require("express");
const router = express.Router();
const YesterdayMessage = require("../models/Yesterday_Message");

router.get("/yesterdayMessage/:userId", async (req, res) => {
  try {
    const msg = await YesterdayMessage.findOne({
      userId: req.params.userId,
    });

    if (!msg || !msg.message) {
      return res.json({
        message: null,
        info: "No message generated yet",
      });
    }

    return res.json({
      message: msg.message,
      date: msg.forDate,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
