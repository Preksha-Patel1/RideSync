const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Driver = require("../models/Driver");
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

function populateRide(rideId) {
  return Ride.findById(rideId).populate("rider", "-password").populate("driver", "-password");
}

async function getRideById(rideId, requestingUser) {
  const ride = await populateRide(rideId);

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

async function acceptRide(rideId, driverUser) {
  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  const driver = await Driver.findOne({ user: driverUser._id });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  assertValidTransition(ride.status, "accepted");

  if (driver.status !== "available") {
    const reason = driver.status === "busy" ? "Driver is already busy" : "Driver must be available to accept rides";
    throw new ApiError(409, reason);
  }

  // Ride and driver must flip together (accepted + busy) or not at all;
  // Atlas is always a replica set, so a transaction is the simplest safe tool here.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      ride.driver = driverUser._id;
      ride.status = "accepted";
      ride.acceptedAt = new Date();
      await ride.save({ session });

      driver.status = "busy";
      await driver.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return populateRide(ride._id);
}

async function startRide(rideId, driverUser) {
  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  if (!ride.driver || ride.driver.toString() !== driverUser._id.toString()) {
    throw new ApiError(403, "You are not the assigned driver for this ride");
  }

  assertValidTransition(ride.status, "started");

  ride.status = "started";
  ride.startedAt = new Date();
  await ride.save();

  return populateRide(ride._id);
}

async function completeRide(rideId, driverUser) {
  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  if (!ride.driver || ride.driver.toString() !== driverUser._id.toString()) {
    throw new ApiError(403, "You are not the assigned driver for this ride");
  }

  assertValidTransition(ride.status, "completed");

  const driver = await Driver.findOne({ user: driverUser._id });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      ride.status = "completed";
      ride.completedAt = new Date();
      await ride.save({ session });

      driver.status = "available";
      await driver.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return populateRide(ride._id);
}

async function cancelRide(rideId, user) {
  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  const requesterId = user._id.toString();
  const isRider = ride.rider.toString() === requesterId;
  const isAssignedDriver = Boolean(ride.driver) && ride.driver.toString() === requesterId;

  // A driver who never accepted this ride has no relationship to it, so a
  // driver attempting to cancel a still-"requested" ride always fails here
  // (ride.driver is null before acceptance, so isAssignedDriver is false).
  if (!isRider && !isAssignedDriver) {
    throw new ApiError(403, "You are not authorized to cancel this ride");
  }

  assertValidTransition(ride.status, "cancelled");

  const assignedDriverId = ride.status === "accepted" ? ride.driver : null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      ride.status = "cancelled";
      ride.cancelledAt = new Date();
      ride.cancelledBy = isRider ? "rider" : "driver";
      await ride.save({ session });

      if (assignedDriverId) {
        const driver = await Driver.findOne({ user: assignedDriverId }).session(session);
        if (driver) {
          driver.status = "available";
          await driver.save({ session });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return populateRide(ride._id);
}

module.exports = {
  createRide,
  getRideById,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  assertValidTransition,
  VALID_TRANSITIONS,
};
