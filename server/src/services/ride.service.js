const Ride = require("../models/Ride");
const ApiError = require("../utils/ApiError");

// Reserved for future days (driver acceptance, cancellation endpoints, etc.)
// so the valid-transition map lives in one place from Day 1 onward.
const VALID_TRANSITIONS = {
  requested: ["accepted", "cancelled"],
  accepted: ["started", "cancelled"],
  started: ["completed"],
  completed: [],
  cancelled: [],
};

function assertValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(400, `Cannot transition ride from '${currentStatus}' to '${nextStatus}'`);
  }
}

async function createRide(riderId, { pickup, destination }) {
  const ride = await Ride.create({
    rider: riderId,
    driver: null,
    pickup,
    destination,
    status: "requested",
  });

  return ride;
}

async function getRideById(rideId, requestingUser) {
  const ride = await Ride.findById(rideId).populate("rider", "-password").populate("driver", "-password");

  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  const riderId = ride.rider._id ? ride.rider._id.toString() : ride.rider.toString();
  const driverId = ride.driver ? (ride.driver._id ? ride.driver._id.toString() : ride.driver.toString()) : null;
  const requesterId = requestingUser._id.toString();

  if (requesterId !== riderId && requesterId !== driverId) {
    throw new ApiError(403, "You are not authorized to view this ride");
  }

  return ride;
}

module.exports = { createRide, getRideById, assertValidTransition, VALID_TRANSITIONS };
