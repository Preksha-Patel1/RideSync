const { createClient } = require("redis");

// Redis keeps everything in memory instead of on disk, so a GET/SET is a
// single fast round trip with no query planning or disk seek involved. That
// speed is exactly why it's a good fit for data that's read constantly and
// changes quickly (driver status, driver location) — but it also means
// Redis is not durable the way MongoDB is: a restart can lose data that
// wasn't persisted, which is precisely why MongoDB — not Redis — remains
// the source of truth for this project (see README "MongoDB vs Redis").
const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    // Retry with backoff, but give up after 10 attempts instead of retrying
    // forever — once we stop retrying, isReady stays false and every
    // redis.service.js call short-circuits to its Mongo fallback instead of
    // hanging the request behind a dead connection.
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.warn("Redis: giving up after 10 reconnect attempts, continuing without cache");
        return false;
      }
      return Math.min(retries * 200, 5000);
    },
  },
});

// Redis connection problems must never crash the API — Redis here is a
// performance optimization, not a required source of truth. Every consumer
// (redis.service.js) already checks client.isReady before using the
// connection, so a dropped connection just means "always fall back to
// MongoDB" until reconnectStrategy above re-establishes it.
client.on("error", (err) => {
  console.warn("Redis client error:", err.message);
});

client.on("connect", () => {
  console.log("Redis connecting...");
});

client.on("ready", () => {
  console.log("Redis connected and ready");
});

client.on("end", () => {
  console.warn("Redis connection closed");
});

async function connectRedis() {
  try {
    await client.connect();
  } catch (err) {
    // Deliberately not re-thrown: server.js treats MongoDB as required
    // (it exits on failure) but Redis as optional (it logs and continues).
    console.warn("Redis: initial connection failed, continuing without cache:", err.message);
  }
}

module.exports = { client, connectRedis };
