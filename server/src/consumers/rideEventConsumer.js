const { kafka } = require("../config/kafka");
const { KAFKA_TOPICS, KAFKA_CONSUMER_GROUP } = require("../config/constants");

const consumer = kafka.consumer({ groupId: KAFKA_CONSUMER_GROUP });
let isConsumerRunning = false;

async function startRideEventConsumer() {
  try {
    await consumer.connect();
    // fromBeginning: false — a consumer (re)starting only sees events
    // produced from now on, not the topic's full history. That's a
    // deliberate Kafka default worth understanding: unlike a database read,
    // "subscribe" doesn't hand you everything that ever happened, only what
    // arrives while you're listening (plus whatever this consumer group's
    // committed offset hasn't caught up to yet, if it has run before).
    await consumer.subscribe({ topic: KAFKA_TOPICS.rideEvents, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        // eachMessage must never throw: an uncaught error here stalls
        // consumer.run()'s internal loop, which would silently stop all
        // further event processing rather than just skipping one bad
        // message. handleMessage() is written so every failure path inside
        // it is caught and logged instead of propagated.
        await handleMessage(message);
      },
    });

    isConsumerRunning = true;
    console.log(`Ride event consumer started (group: ${KAFKA_CONSUMER_GROUP}, topic: ${KAFKA_TOPICS.rideEvents})`);
  } catch (err) {
    // Mirrors the producer/Redis pattern: a Kafka outage at startup means
    // the app runs without background event processing, not that it fails
    // to start. The REST API's own MongoDB-backed behavior is unaffected
    // either way — this consumer only demonstrates async processing on top
    // of state that already exists.
    isConsumerRunning = false;
    console.warn("Ride event consumer failed to start, continuing without event consumption:", err.message);
  }
}

// Day 5 scope: this consumer demonstrates asynchronous event processing by
// validating and logging each ride lifecycle event. It deliberately does
// NOT re-run ride.service.js's business logic or write back to MongoDB —
// MongoDB was already updated synchronously, before the event was even
// published (see ride.service.js's "database first, then publish"
// ordering). Duplicating that logic here would just be a second, poorer
// copy of the same business rules with no MongoDB transaction to protect it.
async function handleMessage(message) {
  const raw = message.value ? message.value.toString() : "";

  let event;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    console.error("Event processing failed: malformed JSON, skipping message:", err.message);
    return;
  }

  if (!event || typeof event.eventType !== "string" || !event.eventId || !event.data) {
    console.error(
      "Event processing failed: event missing eventId/eventType/data, skipping message:",
      raw.slice(0, 200)
    );
    return;
  }

  console.log(`Event processing started: ${event.eventType} (${event.eventId})`);

  try {
    const { rideId, riderId, driverId } = event.data;
    console.log(
      `Event processing completed: ${event.eventType} — ride ${rideId}, rider ${riderId}, driver ${driverId || "none"}`
    );
  } catch (err) {
    console.error(`Event processing failed for ${event.eventType} (${event.eventId}):`, err.message);
  }
}

async function stopRideEventConsumer() {
  if (!isConsumerRunning) return;
  try {
    await consumer.disconnect();
    isConsumerRunning = false;
    console.log("Ride event consumer stopped");
  } catch (err) {
    console.warn("Ride event consumer disconnect error:", err.message);
  }
}

module.exports = { startRideEventConsumer, stopRideEventConsumer };
