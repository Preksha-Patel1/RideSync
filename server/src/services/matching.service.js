const Driver = require("../models/Driver");
const redisService = require("./redis.service");
const { DRIVER_SEARCH_RADIUS_METERS, REDIS_KEYS } = require("../config/constants");

// $near returns results sorted nearest-first, so the first available driver
// within the radius is already the closest one — no in-memory sort needed.
async function findNearestAvailableDriverFromMongo(pickupCoordinates) {
  return Driver.findOne({
    status: "available",
    currentLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: pickupCoordinates },
        $maxDistance: DRIVER_SEARCH_RADIUS_METERS,
      },
    },
  });
}

// This is called on every single ride request, making it the hottest
// geospatial lookup in the app — a good candidate for the Redis GEO set
// maintained by driver.service.js (kept in sync with "available" drivers'
// locations). Cache-aside-flavored: try the fast layer first for *who* the
// nearest driver is, then do exactly one cheap MongoDB lookup for their full
// record. Falls back to the original MongoDB $near query whenever Redis has
// no candidate — either because it's down/unreachable (redisService already
// swallows that and returns null) or because the geo set is genuinely empty
// (e.g. right after a fresh Redis start, before any driver has re-reported
// their location — a known Day 4 limitation, see README).
async function findNearestAvailableDriver(pickupCoordinates) {
  const [longitude, latitude] = pickupCoordinates;

  const nearestDriverId = await redisService.geoSearchNearest(
    REDIS_KEYS.driversGeoSet,
    longitude,
    latitude,
    DRIVER_SEARCH_RADIUS_METERS
  );

  if (nearestDriverId) {
    const driver = await Driver.findOne({ user: nearestDriverId, status: "available" });
    // Defensive re-check: MongoDB is still the source of truth, so if this
    // driver's status has drifted (e.g. cache hadn't caught up yet), fall
    // through to the authoritative MongoDB search below instead of trusting
    // a stale Redis hit.
    if (driver) {
      return driver;
    }
  }

  return findNearestAvailableDriverFromMongo(pickupCoordinates);
}

module.exports = { findNearestAvailableDriver, findNearestAvailableDriverFromMongo };
