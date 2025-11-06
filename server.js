/*
require("dotenv").config(); 
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = require("./src/app"); // Main Express app
const connectDB = require("./src/db/db"); // MongoDB connect
const redisService = require("./src/services/redis.service"); // Redis service

const PORT = process.env.PORT || 5000; // Default port 5000

// ⚡ Express middleware
app.use(cors({
  origin: "http://localhost:5173", // Frontend URL
  credentials: true,               // Allow sending cookies
}));
app.use(cookieParser());           // Parse cookies for auth
app.use(express.json());           // Parse JSON requests

// 🚀 Connect to DB + Redis, then start server
Promise.all([
  connectDB(),
  redisService.connect()
])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Service connection failed:", err);
  });

*/

require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");
const redisService = require("./src/services/redis.service");

const PORT = process.env.PORT || 5000;

Promise.all([connectDB(), redisService.connect()])
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("❌ Service connection failed:", err));
