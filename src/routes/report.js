const express = require("express");
const router = express.Router();
const FoodEntry = require("../models/FoodEntry");

router.get("/report/:userId", async (req, res) => {
  const data = await FoodEntry.findOne({ userId: req.params.userId });
  res.json(data || {});
});

module.exports = router;
