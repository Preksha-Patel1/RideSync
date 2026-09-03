require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // MongoDB is required — a failed connection here should stop startup.
    await connectDB();

    // Redis is an optimization layer, not a requirement (see config/redis.js
    // and README "Redis failure handling"), so its connection is awaited
    // for clean startup logs but never treated as fatal — connectRedis()
    // catches its own errors internally and always resolves.
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
