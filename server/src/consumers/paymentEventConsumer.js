const { kafka } = require("../config/kafka");
const { KAFKA_TOPICS, PAYMENT_CONSUMER_GROUP, SOCKET_EVENTS } = require("../config/constants");
const { getIO } = require("../config/socket");

// Structurally identical to rideEventConsumer.js by design — see that
// file's comments for the full reasoning (fromBeginning: false, why
// eachMessage must never throw, why this doesn't re-run business logic).
// A separate consumer/group from the ride one so payment processing can
// fail, restart, or eventually scale independently of ride-event processing.
const consumer = kafka.consumer({ groupId: PAYMENT_CONSUMER_GROUP });
let isConsumerRunning = false;

async function startPaymentEventConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPICS.paymentEvents, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        await handleMessage(message);
      },
    });

    isConsumerRunning = true;
    console.log(`Payment event consumer started (group: ${PAYMENT_CONSUMER_GROUP}, topic: ${KAFKA_TOPICS.paymentEvents})`);
  } catch (err) {
    isConsumerRunning = false;
    console.warn("Payment event consumer failed to start, continuing without event consumption:", err.message);
  }
}

// MongoDB is already the settled source of truth for payment.status by the
// time any of these events are even published (payment.service.js publishes
// only after its MongoDB write commits) — this consumer's only job is
// logging and bridging to Socket.IO, never re-deciding payment outcomes.
async function handleMessage(message) {
  const raw = message.value ? message.value.toString() : "";

  let event;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    console.error("Payment event processing failed: malformed JSON, skipping message:", err.message);
    return;
  }

  if (!event || typeof event.eventType !== "string" || !event.eventId || !event.data) {
    console.error(
      "Payment event processing failed: event missing eventId/eventType/data, skipping message:",
      raw.slice(0, 200)
    );
    return;
  }

  console.log(`Event processing started: ${event.eventType} (${event.eventId})`);

  try {
    const { paymentId, rideId, riderId, amount, currency } = event.data;
    console.log(
      `Event processing completed: ${event.eventType} — payment ${paymentId}, ride ${rideId}, rider ${riderId}, amount ${amount} ${currency}`
    );

    broadcastPaymentStatus(event);
  } catch (err) {
    console.error(`Event processing failed for ${event.eventType} (${event.eventId}):`, err.message);
  }
}

function broadcastPaymentStatus(event) {
  const io = getIO();
  if (!io) {
    console.warn(`Socket.IO not initialized yet — skipping real-time broadcast for ${event.eventType}`);
    return;
  }

  const { paymentId, rideId, amount, currency } = event.data;
  // "payment.success" -> "success", "payment.failed" -> "failed",
  // "payment.created" -> "created" — same derivation rideEventConsumer.js
  // uses, reused here rather than a second mapping table.
  const status = event.eventType.split(".")[1];

  // Broadcast to the ride's room, not a payment-specific room: a payment's
  // audience (the rider, currently in ride:<rideId> from Day 6) is a subset
  // of that ride's participants, so a second room would be pure duplication
  // for no additional access-control benefit.
  io.to(`ride:${rideId}`).emit(SOCKET_EVENTS.serverToClient.paymentStatusUpdated, {
    event: SOCKET_EVENTS.serverToClient.paymentStatusUpdated,
    paymentId,
    rideId,
    status,
    amount,
    currency,
    timestamp: event.timestamp,
  });
}

async function stopPaymentEventConsumer() {
  if (!isConsumerRunning) return;
  try {
    await consumer.disconnect();
    isConsumerRunning = false;
    console.log("Payment event consumer stopped");
  } catch (err) {
    console.warn("Payment event consumer disconnect error:", err.message);
  }
}

module.exports = { startPaymentEventConsumer, stopPaymentEventConsumer };
