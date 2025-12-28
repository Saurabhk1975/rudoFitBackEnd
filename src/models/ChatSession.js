const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ChatSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },

  messages: [MessageSchema],

  // 🔥 THIS is the memory
  summary: { type: String, default: "" },

  updatedAt: { type: Date, default: Date.now }
});

// 🔥 Auto delete after 30 days
ChatSessionSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }
);

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
