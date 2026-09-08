const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Driver = require("../models/Driver");
const ApiError = require("../utils/ApiError");
const matchingService = require("./matching.service");
const driverService = require("./driver.service");
const driverSimulationService = require("./driverSimulationService");
const kafkaProducer = require("./kafkaProducer");
const { notifyMatchedDriver } = require("../consumers/rideEventConsumer");
const { KAFKA_TOPICS, RIDE_EVENT_TYPES, DRIVER_SEARCH_RADIUS_METERS } = require("../config/constants");

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
  console.log(`[Ride] Created: ${ride._id} — status: REQUESTED`);

  // Best-effort nearby-driver lookup: it only annotates the ride with a
  // candidate for display purposes, so a lookup failure or empty result
  // must never block ride creation itself.
  console.log(`[Ride] Searching for available driver near [${pickup.location.coordinates}]`);
  const nearestDriver = await matchingService.findNearestAvailableDriver(pickup.location.coordinates);
  if (nearestDriver) {
    console.log(`[Ride] Driver selected: ${nearestDriver.user} (driver doc ${nearestDriver._id})`);
    ride.matchedDriver = nearestDriver.user;
    await ride.save();

    // Demo/portfolio mode: a seeded simulated driver stands in for the real
    // driver app that would otherwise need to be open to accept this ride.
    // A real matched driver is untouched — they keep the normal manual
    // accept/reject flow via their own session.
    if (nearestDriver.isSimulated) {
      driverSimulationService.scheduleSimulatedAcceptance(ride._id, nearestDriver.user);
    }
  } else {
    console.log("[Ride] No available driver found within search radius");
  }

  // Database first, then publish: the event must describe something that
  // actually happened. Publishing before Ride.create() succeeded could
  // announce a ride.requested for a ride that was never actually persisted
  // (e.g. if create() then threw) — readers of the event would believe
  // something exists that MongoDB never has a record of. publishEvent()
  // itself never throws (see kafkaProducer.js), so a Kafka outage here
  // can't undo or fail this already-successful ride creation.
  // matchedDriverId (distinct from driverId, which stays null until an
  // accept) is what lets the consumer notify the one candidate driver of
  // this new request — see consumers/rideEventConsumer.js. It's still
  // purely advisory: the consumer's notification doesn't reserve anything,
  // any available driver can still accept (see matching.service.js).
  await kafkaProducer.publishEvent(KAFKA_TOPICS.rideEvents, RIDE_EVENT_TYPES.requested, {
    rideId: ride._id.toString(),
    riderId: riderId.toString(),
    driverId: null,
    matchedDriverId: nearestDriver ? nearestDriver.user.toString() : null,
  });

  return populateRide(ride._id);
}

// .lean() because this is purely a read path — every caller only ever
// serializes the result into a JSON response, never re-saves it (mutations
// happen on the separate, non-lean documents fetched inside each
// transition function above). That makes it safe to bolt extra fields onto
// the plain object below, which a real Mongoose document's schema-bound
// toJSON would otherwise silently drop.
async function populateRide(rideId) {
  const ride = await Ride.findById(rideId)
    .populate("rider", "-password")
    .populate("driver", "-password")
    .populate("matchedDriver", "-password")
    .lean();

  // Ride only references the driver's User account (name/phone) — vehicle
  // and rating live on the separate Driver/Vehicle documents (see
  // models/Driver.js, models/Vehicle.js). Attached here, once, so every
  // caller (createRide, acceptRide, getRideById, ...) gets the same shape
  // without duplicating this lookup at each call site.
  if (ride && ride.driver) {
    const driverProfile = await Driver.findOne({ user: ride.driver._id })
      .select("rating")
      .populate("vehicle")
      .lean();
    if (driverProfile) {
      ride.driver = { ...ride.driver, rating: driverProfile.rating, vehicle: driverProfile.vehicle };
    }
  }

  return ride;
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
  const existingRide = await Ride.findById(rideId);
  if (!existingRide) {
    throw new ApiError(404, "Ride not found");
  }

  // Cheap pre-checks for the common (non-racing) case: give the caller the
  // most specific error immediately instead of always paying for a transaction.
  assertValidTransition(existingRide.status, "accepted");

  // Cache-aside read: on a hot path like "driver taps accept", checking
  // Redis first (populated by driver.service.js's cache-aside/write-through)
  // means a driver who's already busy gets rejected without a MongoDB round
  // trip at all. This is only a fast-fail optimization, never the final
  // word — the atomic findOneAndUpdate below re-checks status against
  // MongoDB itself, so a stale/missing cache entry can never let two rides
  // get assigned to one driver.
  const cachedStatus = await driverService.getDriverStatus(driverUser._id);
  if (cachedStatus !== "available") {
    const reason = cachedStatus === "busy" ? "Driver is already busy" : "Driver must be available to accept rides";
    throw new ApiError(409, reason);
  }

  const driver = await Driver.findOne({ user: driverUser._id });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  // Race window: two drivers can both read status="requested" above before
  // either writes, and both would believe they won. A plain `ride.save()`
  // after that read (the Day 2 approach) would let the second writer silently
  // overwrite the first driver's acceptance with their own. findOneAndUpdate's
  // filter re-checks `status: "requested"` atomically at write time — only the
  // first update matches and applies; the loser gets `null` back and a clean
  // 409 instead of corrupting the ride. Same idea for the driver's status flip,
  // in case this same driver is racing to accept two different rides at once.
  // The transaction on top keeps Ride and Driver moving together — the ride
  // is never left "accepted" with its driver still "available".
  let ride;
  let claimedDriverForCache;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      ride = await Ride.findOneAndUpdate(
        { _id: rideId, status: "requested" },
        { $set: { driver: driverUser._id, status: "accepted", acceptedAt: new Date() } },
        { new: true, session }
      );
      if (!ride) {
        throw new ApiError(409, "Ride was already accepted by another driver");
      }

      const claimedDriver = await Driver.findOneAndUpdate(
        { _id: driver._id, status: "available" },
        { $set: { status: "busy" } },
        { new: true, session }
      );
      if (!claimedDriver) {
        throw new ApiError(409, "Driver is already busy");
      }

      claimedDriverForCache = claimedDriver;
    });
  } finally {
    await session.endSession();
  }

  // Keep Redis in sync the moment MongoDB's status flip is committed —
  // otherwise the cache would keep answering "available" for up to
  // REDIS_DRIVER_TTL_SECONDS after this driver actually went busy.
  await driverService.syncStatusCache(claimedDriverForCache);

  console.log(`[Ride] Driver accepted: ${ride._id} — driver ${driverUser._id} — status changed: ACCEPTED`);

  // Published only after the transaction above has actually committed — see
  // createRide's comment for why this ordering is non-negotiable.
  await kafkaProducer.publishEvent(KAFKA_TOPICS.rideEvents, RIDE_EVENT_TYPES.accepted, {
    rideId: ride._id.toString(),
    riderId: existingRide.rider.toString(),
    driverId: driverUser._id.toString(),
  });
  console.log(`[Socket] Notifying rider ${existingRide.rider} of acceptance (via ride:${ride._id} room)`);

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

  await kafkaProducer.publishEvent(KAFKA_TOPICS.rideEvents, RIDE_EVENT_TYPES.started, {
    rideId: ride._id.toString(),
    riderId: ride.rider.toString(),
    driverId: driverUser._id.toString(),
  });

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

  // See acceptRide's matching comment: MongoDB's write just committed, so
  // Redis needs to move with it rather than wait out its TTL.
  await driverService.syncStatusCache(driver);
  await matchWaitingRideToDriver(driver);

  await kafkaProducer.publishEvent(KAFKA_TOPICS.rideEvents, RIDE_EVENT_TYPES.completed, {
    rideId: ride._id.toString(),
    riderId: ride.rider.toString(),
    driverId: driverUser._id.toString(),
  });

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

  let freedDriverForCache = null;
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
          freedDriverForCache = driver;
        }
      }
    });
  } finally {
    await session.endSession();
  }

  if (freedDriverForCache) {
    await driverService.syncStatusCache(freedDriverForCache);
    await matchWaitingRideToDriver(freedDriverForCache);
  }

  await kafkaProducer.publishEvent(KAFKA_TOPICS.rideEvents, RIDE_EVENT_TYPES.cancelled, {
    rideId: ride._id.toString(),
    riderId: ride.rider.toString(),
    driverId: assignedDriverId ? assignedDriverId.toString() : null,
    cancelledBy: ride.cancelledBy,
  });

  return populateRide(ride._id);
}

// Matching (createRide) only ever runs once, at request time — if nobody
// was available then, the ride just sits at "requested" with no
// matchedDriver forever, even if a driver frees up moments later. This
// closes that gap from the other direction: called whenever a driver
// transitions to "available" (see driver.controller.js#updateStatus,
// and completeRide/cancelRide below), it looks for the single oldest
// still-unmatched waiting ride within range and, if one exists, matches
// this driver to it exactly the way createRide would have if the timing
// had lined up — same notification, same simulated-acceptance hookup.
//
// findOneAndUpdate's filter re-checks status/matchedDriver atomically at
// write time, the same race-safety idea as acceptRide: if two drivers
// become available in the same instant, only one of them can claim any
// given waiting ride.
async function matchWaitingRideToDriver(driverDoc) {
  if (!driverDoc || driverDoc.status !== "available") return;

  const [longitude, latitude] = driverDoc.currentLocation?.coordinates || [0, 0];
  if (longitude === 0 && latitude === 0) return; // no real location on record yet

  const ride = await Ride.findOneAndUpdate(
    {
      status: "requested",
      matchedDriver: null,
      "pickup.location": {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: DRIVER_SEARCH_RADIUS_METERS,
        },
      },
    },
    { $set: { matchedDriver: driverDoc.user } },
    { new: true }
  );

  if (!ride) return;

  console.log(`[Ride] Late-matched waiting ride ${ride._id} to newly available driver ${driverDoc.user}`);

  await notifyMatchedDriver({
    data: { rideId: ride._id.toString(), matchedDriverId: driverDoc.user.toString() },
  });

  if (driverDoc.isSimulated) {
    driverSimulationService.scheduleSimulatedAcceptance(ride._id, driverDoc.user);
  }
}

async function getMyRides(user, { page, limit } = {}) {
  const filter = user.role === "driver" ? { driver: user._id } : { rider: user._id };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const [rides, totalCount] = await Promise.all([
    Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("rider", "-password")
      .populate("driver", "-password"),
    Ride.countDocuments(filter),
  ]);

  return {
    rides,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
    },
  };
}

module.exports = {
  createRide,
  getRideById,
  getMyRides,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  matchWaitingRideToDriver,
  assertValidTransition,
  VALID_TRANSITIONS,
};
