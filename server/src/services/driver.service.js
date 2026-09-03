const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const ApiError = require("../utils/ApiError");
const redisService = require("./redis.service");
const { REDIS_DRIVER_TTL_SECONDS, REDIS_KEYS } = require("../config/constants");

async function createProfile(userId, { vehicleType, brand, model, registrationNumber }) {
  const existingDriver = await Driver.findOne({ user: userId });
  if (existingDriver) {
    throw new ApiError(409, "Driver profile already exists for this user");
  }

  const existingVehicle = await Vehicle.findOne({ registrationNumber: registrationNumber.toUpperCase() });
  if (existingVehicle) {
    throw new ApiError(409, "A vehicle with this registration number already exists");
  }

  const driver = await Driver.create({ user: userId, status: "offline" });

  const vehicle = await Vehicle.create({
    driver: driver._id,
    vehicleType,
    brand,
    model,
    registrationNumber,
  });

  driver.vehicle = vehicle._id;
  await driver.save();

  return getProfileByUserId(userId);
}

async function getProfileByUserId(userId) {
  const driver = await Driver.findOne({ user: userId })
    .populate("user", "-password")
    .populate("vehicle");

  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  return driver;
}

// Cache-aside read: check Redis first, and only fall back to MongoDB (the
// source of truth) on a miss — then re-populate Redis so the next read for
// the same driver is fast again. This is deliberately used only for the
// single `status` field, not the full driver profile: the profile read
// (getProfileByUserId, above) always needs a populated Mongo document for
// the vehicle/user data anyway, so caching it wouldn't save a query. Status
// alone is small, read far more often than it changes, and is exactly the
// kind of value acceptRide's pre-check (ride.service.js) re-reads on every
// accept attempt — a good candidate to serve from memory instead of disk.
async function getDriverStatus(userId) {
  const cacheKey = REDIS_KEYS.driverStatus(userId);

  const cached = await redisService.get(cacheKey);
  if (cached) {
    return cached; // cache hit — MongoDB was not queried
  }

  // cache miss — fall back to MongoDB, then populate the cache for next time
  const driver = await Driver.findOne({ user: userId }).select("status");
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  await redisService.set(cacheKey, driver.status, REDIS_DRIVER_TTL_SECONDS);
  return driver.status;
}

async function updateStatus(userId, status) {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  driver.status = status;
  await driver.save();

  await syncStatusCache(driver);

  return driver;
}

async function updateLocation(userId, coordinates) {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  driver.currentLocation = { type: "Point", coordinates };
  await driver.save();

  // Only "available" drivers should be discoverable by matching, so only
  // add them to the geo set while they're actually available. A busy/
  // offline driver's location is still saved to MongoDB (useful for their
  // own history/profile), it's just not surfaced to nearby-search.
  if (driver.status === "available") {
    const [longitude, latitude] = coordinates;
    await redisService.geoAdd(REDIS_KEYS.driversGeoSet, String(driver.user), longitude, latitude);
  }

  return driver;
}

// Whenever a driver's status changes anywhere in the app (here, or from
// ride.service.js on accept/complete/cancel), the Redis copy has to move
// with it — otherwise a driver who just went "busy" would keep reading back
// a cached "available" for up to REDIS_DRIVER_TTL_SECONDS. Two ways to fix a
// stale cache exist: (A) delete the key and let the next read reload it from
// MongoDB, or (B) write the new value directly. This uses (B) because the
// caller already has the exact new value in hand — writing it is one Redis
// call, the same cost as a delete, but skips a guaranteed-miss on whichever
// request reads it next.
async function syncStatusCache(driver) {
  const cacheKey = REDIS_KEYS.driverStatus(driver.user);
  await redisService.set(cacheKey, driver.status, REDIS_DRIVER_TTL_SECONDS);

  if (driver.status === "available") {
    // Re-add using their last known location, if any, so a driver who was
    // busy and just came back online is immediately matchable again.
    const [longitude, latitude] = driver.currentLocation.coordinates;
    if (longitude !== 0 || latitude !== 0) {
      await redisService.geoAdd(REDIS_KEYS.driversGeoSet, String(driver.user), longitude, latitude);
    }
  } else {
    await redisService.geoRemove(REDIS_KEYS.driversGeoSet, String(driver.user));
  }
}

module.exports = {
  createProfile,
  getProfileByUserId,
  getDriverStatus,
  updateStatus,
  updateLocation,
  syncStatusCache,
};
