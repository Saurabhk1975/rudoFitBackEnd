require("dotenv").config();
console.log(
  "GROQ_API_KEY:",
  process.env.GROQ_API_KEY ? "Loaded ✅" : "❌ Missing"
);

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");

// ROUTES
const profileRoutes = require("./src/routes/profile");
const foodRoutes = require("./src/routes/food");
const aiRoutes = require("./src/routes/ai");
const waterRoutes = require("./src/routes/water");
const reportRoutes = require("./src/routes/report");
const fcmRoutes = require("./src/routes/fcm");
const locationRoutes = require("./src/routes/location"); // ✅ ADD THIS
const message = require("./src/routes/yesterdayMessage.js");

const app = express();

// MIDDLEWARE
app.use(express.json({ limit: "2mb" }));
app.use(cors());
app.use("/uploads", express.static("uploads"));

// CONNECT DB
connectDB();

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("✅ API server is running!");
});

// REGISTER ROUTES
app.use("/api", profileRoutes);
app.use("/api", foodRoutes);
app.use("/api", aiRoutes);
app.use("/api", waterRoutes);
app.use("/api", reportRoutes);
app.use("/api", fcmRoutes);
app.use("/api", locationRoutes); // ✅ IMPORTANT
app.use("/api",message);

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
