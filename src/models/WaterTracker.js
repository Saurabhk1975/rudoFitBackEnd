const mongoose = require("mongoose");

const WaterTrackerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  totalIntake: { type: Number, default: 0 },
});

module.exports = mongoose.model("WaterTracker", WaterTrackerSchema);
