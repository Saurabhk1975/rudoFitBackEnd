<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const FoodEntry = require("../models/FoodEntry");

router.get("/report/:userId", async (req, res) => {
  const data = await FoodEntry.findOne({ userId: req.params.userId });
  res.json(data || {});
});

module.exports = router;
=======
const express = require("express");
const router = express.Router();
const FoodEntry = require("../models/FoodEntry");

router.get("/report/:userId", async (req, res) => {
  const data = await FoodEntry.findOne({ userId: req.params.userId });
  res.json(data || {});
});

module.exports = router;
>>>>>>> 144b3b460fbdfcb1fe8ce0688ced89453835d895
