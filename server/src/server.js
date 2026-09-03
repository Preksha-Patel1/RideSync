require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis, client: redisClient } = require("./config/redis");
const { connectProducer, disconnectProducer } = require("./services/kafkaProducer");
const { startRideEventConsumer, stopRideEventConsumer } = require("./consumers/rideEventConsumer");

const PORT = process.env.PORT || 5000;

let httpServer;

async function start() {
  try {
    // MongoDB is required — a failed connection here should stop startup.
    await connectDB();

    // Redis and Kafka are optimization/event-transport layers, not
    // requirements (see config/redis.js, config/kafka.js, and README
    // "Redis failure handling" / "Kafka failure scenarios"), so their
    // connections are awaited for clean, ordered startup logs but never
    // treated as fatal — connectRedis()/connectProducer()/
    // startRideEventConsumer() each catch their own errors internally and
    // always resolve, even if the underlying broker is unreachable.
    await connectRedis();
    await connectProducer();
    await startRideEventConsumer();

    httpServer = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

// Reverses the startup order: stop taking new HTTP requests first, then
// tear down the background/event layers, then the databases — so nothing
// still-running gets cut off mid-operation by a connection disappearing
// underneath it.
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
    console.log("HTTP server closed");
  }

  await stopRideEventConsumer();
  await disconnectProducer();

  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log("Redis connection closed");
  }

  await mongoose.connection.close();
  console.log("MongoDB connection closed");

  console.log("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
