const { Kafka, logLevel } = require("kafkajs");

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map((broker) => broker.trim());

// kafkajs has its own internal logger (connection retries, broker metadata,
// etc.) that's noisy by default. This project does its own structured
// logging at each meaningful operation instead (see kafkaProducer.js and
// consumers/rideEventConsumer.js: "producer connected", "event published",
// "event consumed", ...), so kafkajs' own logger is silenced here to avoid
// duplicate, harder-to-read output.
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "ridesync-backend",
  brokers,
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 300,
    retries: 3,
  },
  // Bounds how long any single Kafka operation can block. Without this, a
  // request that touches Kafka mid-flight (e.g. acceptRide publishing
  // "ride.accepted") could hang for kafkajs' 30s default while a broker is
  // unreachable, well past what an HTTP client will wait for a response.
  requestTimeout: 5000,
});

module.exports = { kafka };
