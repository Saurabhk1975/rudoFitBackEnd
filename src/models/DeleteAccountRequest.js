const mongoose = require("mongoose");

const DeleteAccountRequestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "DeleteAccountRequest",
  DeleteAccountRequestSchema
);
