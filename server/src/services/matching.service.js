const Driver = require("../models/Driver");
const { DRIVER_SEARCH_RADIUS_METERS } = require("../config/constants");

// $near returns results sorted nearest-first, so the first available driver
// within the radius is already the closest one — no in-memory sort needed.
async function findNearestAvailableDriver(pickupCoordinates) {
  const driver = await Driver.findOne({
    status: "available",
    currentLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: pickupCoordinates },
        $maxDistance: DRIVER_SEARCH_RADIUS_METERS,
      },
    },
  });

  return driver;
}

module.exports = { findNearestAvailableDriver };
