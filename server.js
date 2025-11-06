
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
