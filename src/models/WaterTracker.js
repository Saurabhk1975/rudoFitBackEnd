<<<<<<< HEAD
const mongoose = require("mongoose");

const WaterTrackerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  totalIntake: { type: Number, default: 0 },
});

module.exports = mongoose.model("WaterTracker", WaterTrackerSchema);
=======
const mongoose = require("mongoose");

const WaterTrackerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  totalIntake: { type: Number, default: 0 },
});

module.exports = mongoose.model("WaterTracker", WaterTrackerSchema);
>>>>>>> 144b3b460fbdfcb1fe8ce0688ced89453835d895
