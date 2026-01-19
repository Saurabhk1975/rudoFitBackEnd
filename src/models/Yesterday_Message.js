// src/models/YesterdayMessage.js
const mongoose = require("mongoose");

const YesterdayMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    date: {
      type: String, // YYYY-MM-DD (IST)
      required: true,
      index: true,
    },

    message: {
      type: String,
      default: "",
    },

    isUpdated: {
      type: Boolean,
      default: true, // true = AI needs to generate
    },
  },
  { timestamps: true }
);

// prevent duplicates per user per day
YesterdayMessageSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("YesterdayMessage", YesterdayMessageSchema);
