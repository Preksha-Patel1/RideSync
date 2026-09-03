const DRIVER_SEARCH_RADIUS_METERS = Number(process.env.DRIVER_SEARCH_RADIUS_METERS) || 5000;

// Driver status/location change every time a ride starts, ends, or a
// location ping comes in — a long TTL would let a stale "available" outlive
// the driver actually going busy. Kept short and configurable rather than
// hardcoded so it can be tuned without touching code.
const REDIS_DRIVER_TTL_SECONDS = Number(process.env.REDIS_DRIVER_TTL_SECONDS) || 30;

// Key names centralized here so every service that touches Redis agrees on
// the same naming scheme instead of duplicating string literals.
const REDIS_KEYS = {
  driverStatus: (userId) => `driver:status:${userId}`,
  driversGeoSet: "drivers:geo",
};

// Centralized here for the same reason as REDIS_KEYS above: every producer/
// consumer that touches Kafka agrees on one topic name and one consumer
// group id instead of duplicating string literals.
const KAFKA_TOPICS = {
  rideEvents: "ride-events",
};

// A consumer group is how Kafka tracks "how far has this logical consumer
// read" (its committed offsets) and how it would split partitions across
// multiple consumer processes sharing the same group id, if more than one
// were running. RideSync runs a single consumer for Day 5, but naming the
// group now means scaling to several consumer instances later needs no
// code change — they'd just join this same group and Kafka would divide
// the topic's partitions between them automatically.
const KAFKA_CONSUMER_GROUP = "ridesync-ride-consumers";

// Event *names* describe something that already happened (past tense),
// deliberately distinct from the *command* endpoints that triggered them
// (e.g. the command is "PATCH /rides/:id/accept", the resulting event is
// "ride.accepted"). See ride.service.js and README "Command vs Event".
const RIDE_EVENT_TYPES = {
  requested: "ride.requested",
  accepted: "ride.accepted",
  started: "ride.started",
  completed: "ride.completed",
  cancelled: "ride.cancelled",
};

module.exports = {
  DRIVER_SEARCH_RADIUS_METERS,
  REDIS_DRIVER_TTL_SECONDS,
  REDIS_KEYS,
  KAFKA_TOPICS,
  KAFKA_CONSUMER_GROUP,
  RIDE_EVENT_TYPES,
};
