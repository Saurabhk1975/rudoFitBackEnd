// src/routes/yesterdayMessage.js
const express = require("express");
const router = express.Router();
const YesterdayMessage = require("../models/Yesterday_Message");

router.get("/yesterdayMessage/:userId", async (req, res) => {
  const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  date.setDate(date.getDate() - 1);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const iso = `${y}-${m}-${d}`;

  const msg = await YesterdayMessage.findOne({
    userId: req.params.userId,
    date: iso,
  });

  if (!msg || !msg.message) {
    return res.json({
      message: null,
      info: "No message generated yet",
    });
  }

  res.json({
    date: iso,
    message: msg.message,
  });
});

module.exports = router;
