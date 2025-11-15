require("dotenv").config();
console.log(
  "GROQ_API_KEY:",
  process.env.GROQ_API_KEY ? "Loaded ✅" : "❌ Missing"
);

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");

const profileRoutes = require("./src/routes/profile");
// const foodRoutes = require("./src/routes/food");
const aiRoutes = require("./src/routes/ai.js");
const waterRoutes = require("./src/routes/water");
const reportRoutes = require("./src/routes/report");
const foodRoutes = require("./src/routes/food");

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

// connect to Mongo
connectDB();

// TEST route
app.get("/", (req, res) => {
  res.send("✅ API server is running!");
});

// main routers
app.use("/api", profileRoutes);
// app.use("/api", foodRoutes);
app.use("/api", aiRoutes);
app.use("/api", waterRoutes);
app.use("/api", reportRoutes);
app.use("/api", foodRoutes);

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
