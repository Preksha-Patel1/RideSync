const crypto = require("crypto");
const { kafka } = require("../config/kafka");

const producer = kafka.producer();
let isProducerConnected = false;

async function connectProducer() {
  try {
    await producer.connect();
    isProducerConnected = true;
    console.log("Kafka producer connected");
  } catch (err) {
    // Mirrors config/redis.js: Kafka is an event-transport optimization,
    // not a required source of truth (MongoDB already holds the durable
    // ride state by the time any event would be published — see "database
    // first" in ride.service.js). A broker being unreachable at startup
    // must not stop the API from serving requests.
    isProducerConnected = false;
    console.warn("Kafka producer connection failed, continuing without event publishing:", err.message);
  }
}

async function disconnectProducer() {
  if (!isProducerConnected) return;
  try {
    await producer.disconnect();
    isProducerConnected = false;
    console.log("Kafka producer disconnected");
  } catch (err) {
    console.warn("Kafka producer disconnect error:", err.message);
  }
}

// Builds the standard event envelope and publishes it. Never throws —
// callers (ride.service.js) call this *after* their MongoDB write has
// already committed, so a publish failure must be logged, never allowed to
// fail the API response for a business action that already succeeded.
//
// eventId (a UUID, via Node's built-in crypto.randomUUID — no extra
// dependency needed) matters once you have retries, duplicate deliveries,
// or multiple consumers in the picture: it's what lets a consumer recognize
// "I've already handled this exact event" instead of double-processing it,
// and it's what you'd grep server/consumer logs for when debugging a
// specific event's journey end to end. Day 5 does not implement that
// dedup/idempotency check in the consumer yet — see README "Idempotent
// consumers" — but every event already carries the id that check would need.
async function publishEvent(topic, eventType, data) {
  const envelope = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    version: 1,
    data,
  };

  if (!isProducerConnected) {
    console.warn(`Kafka producer not connected — skipping publish of "${eventType}" (${envelope.eventId})`);
    return false;
  }

  try {
    await producer.send({
      topic,
      // Keying by rideId (not eventId) means every event for the same ride
      // lands on the same partition and is therefore delivered to any given
      // consumer in the order it was produced — accepted before started,
      // started before completed — which matters for a lifecycle like this.
      messages: [{ key: data.rideId, value: JSON.stringify(envelope) }],
    });
    console.log(`Event published: ${eventType} (${envelope.eventId})`);
    return true;
  } catch (err) {
    // A send failure (as opposed to a startup connect failure) means the
    // broker went away mid-run. Marking the producer disconnected here is
    // what keeps the next request fast: without it, every subsequent
    // publishEvent call would retry against a dead broker and eat the same
    // ~5s requestTimeout penalty this one just did, on every single ride
    // mutation, for as long as Kafka stays down. The tradeoff — documented,
    // not accidental — is that this app does not attempt to reconnect in
    // the background afterward; publishing stays off until the process is
    // restarted. A production system would use kafkajs's own connect/
    // disconnect events or a periodic health check to self-heal; that's
    // more retry/reconnection infrastructure than Day 5 is scoped to build.
    isProducerConnected = false;
    console.error(`Event publish failed for "${eventType}" (${envelope.eventId}):`, err.message);
    return false;
  }
}

module.exports = { connectProducer, disconnectProducer, publishEvent };
