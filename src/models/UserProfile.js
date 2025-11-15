const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: String,
  mobileNumber: String,
  age: Number,
  gender: String,
  weight: Number,
  height: Number,
  weightUnit: String,
  heightUnit: String,
  targetWeight: Number,
  goal: { type: String, enum: ["gain", "lose", "stay fit"] },
  physicalActivity: { type: String, enum: ["lessActive", "NormalActive", "IntenseWorkOut"] },
  targetCalorie: { type: Number, default: 0 },
  targetProtein: { type: Number, default: 0 },
  targetFat: { type: Number, default: 0 },
  targetCarb: { type: Number, default: 0 },
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
