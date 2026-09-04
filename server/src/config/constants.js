const DRIVER_SEARCH_RADIUS_METERS = Number(process.env.DRIVER_SEARCH_RADIUS_METERS) || 5000;

// Driver status/location change every time a ride starts, ends, or a
// location ping comes in — a long TTL would let a stale "available" outlive
// the driver actually going busy. Kept short and configurable rather than
// hardcoded so it can be tuned without touching code.
const REDIS_DRIVER_TTL_SECONDS = Number(process.env.REDIS_DRIVER_TTL_SECONDS) || 30;

// A ride's live driver-location stream (Day 6) needs to survive brief gaps
// between socket updates but should self-clean if a ride's socket flow is
// ever abandoned (app crash, driver never reconnects) — a sliding TTL
// refreshed on every update, rather than tied to the ride's own lifecycle.
const REDIS_RIDE_LOCATION_TTL_SECONDS = Number(process.env.REDIS_RIDE_LOCATION_TTL_SECONDS) || 120;

// Key names centralized here so every service that touches Redis agrees on
// the same naming scheme instead of duplicating string literals.
const REDIS_KEYS = {
  driverStatus: (userId) => `driver:status:${userId}`,
  driversGeoSet: "drivers:geo",
  // Deliberately a *separate* key from driversGeoSet: that set's invariant
  // (Day 4) is "only currently-matchable available drivers" — a driver on
  // an active ride is "busy" and must stay out of it. This key instead
  // tracks "where is the driver on ride X right now", independent of
  // matchability, keyed per ride rather than per driver.
  rideDriverLocation: (rideId) => `ride:${rideId}:driver-location`,
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

// Client->server and server->client socket event names, centralized for the
// same reason as the Kafka/Redis constants above — one name per concept,
// agreed on by every file that emits or listens for it.
const SOCKET_EVENTS = {
  clientToServer: {
    joinRide: "join_ride",
    driverLocationUpdate: "driver_location_update",
  },
  serverToClient: {
    rideJoined: "ride_joined",
    rideStatusUpdated: "ride_status_updated",
    driverLocationUpdated: "driver_location_updated",
    rideError: "ride_error",
  },
};

module.exports = {
  DRIVER_SEARCH_RADIUS_METERS,
  REDIS_DRIVER_TTL_SECONDS,
  REDIS_RIDE_LOCATION_TTL_SECONDS,
  REDIS_KEYS,
  KAFKA_TOPICS,
  KAFKA_CONSUMER_GROUP,
  RIDE_EVENT_TYPES,
  SOCKET_EVENTS,
};
