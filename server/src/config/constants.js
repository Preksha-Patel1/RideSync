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

module.exports = { DRIVER_SEARCH_RADIUS_METERS, REDIS_DRIVER_TTL_SECONDS, REDIS_KEYS };
