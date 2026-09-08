const User = require("../models/User");
const Ride = require("../models/Ride");

// Demo/portfolio feature only: RideSync's real matching (matching.service.js)
// only ever notifies one driver — it was designed assuming a real driver's
// app would be open to receive that notification and tap Accept. Without a
// second (real) driver session running, a ride would sit at "requested"
// forever. This service stands in for that missing real driver end-to-end
// (accept -> start -> complete) but only for drivers seeded by
// scripts/seedDrivers.js (Driver.isSimulated) — a real driver who happens to
// be the nearest match is never auto-progressed on their behalf, they keep
// the normal manual flow throughout. Swapping this file out (or just not
// seeding simulated drivers) is all it takes to go back to a fully
// real-driver-only setup later.
const ACCEPT_MIN_MS = 2000;
const ACCEPT_MAX_MS = 5000;
// "Driver is on the way to pickup" - shorter than the ride itself.
const START_MIN_MS = 3000;
const START_MAX_MS = 6000;
// "Ride in progress" - the longest stage, so a demo still has a moment to
// watch the "in progress" state before it completes.
const COMPLETE_MIN_MS = 8000;
const COMPLETE_MAX_MS = 15000;

function randomDelay(min, max) {
  return min + Math.random() * (max - min);
}

function scheduleSimulatedAcceptance(rideId, driverUserId) {
  const delay = randomDelay(ACCEPT_MIN_MS, ACCEPT_MAX_MS);
  console.log(`[Simulation] Driver ${driverUserId} will respond to ride ${rideId} in ~${Math.round(delay / 1000)}s`);

  setTimeout(() => {
    runSimulatedAcceptance(rideId, driverUserId).catch((err) => {
      console.warn(`[Simulation] Auto-accept failed for ride ${rideId}:`, err.message);
    });
  }, delay);
}

async function runSimulatedAcceptance(rideId, driverUserId) {
  // The ride may have already been accepted (a real driver racing the same
  // match, or a second simulated timer), cancelled by the rider, or simply
  // no longer exist. acceptRide's own atomic status check would catch all
  // of this anyway, but checking first avoids a noisy 409 in the common
  // case and keeps the log readable.
  const ride = await Ride.findById(rideId).select("status");
  if (!ride || ride.status !== "requested") {
    console.log(`[Simulation] Ride ${rideId} is no longer requested (status: ${ride?.status ?? "not found"}) — skipping accept`);
    return;
  }

  const driverUser = await User.findById(driverUserId);
  if (!driverUser) {
    console.warn(`[Simulation] Simulated driver ${driverUserId} not found — skipping accept`);
    return;
  }

  // Required inside each function, not at module load: ride.service.js
  // requires this file to schedule the simulation, so a top-level require
  // here would be circular. By the time any of these timers fire (seconds
  // later), ride.service.js has long finished loading.
  const rideService = require("./ride.service");
  await rideService.acceptRide(rideId, driverUser);
  console.log(`[Simulation] Driver ${driverUserId} auto-accepted ride ${rideId}`);

  scheduleSimulatedStart(rideId, driverUser);
}

function scheduleSimulatedStart(rideId, driverUser) {
  const delay = randomDelay(START_MIN_MS, START_MAX_MS);
  console.log(`[Simulation] Driver ${driverUser._id} will start ride ${rideId} in ~${Math.round(delay / 1000)}s`);

  setTimeout(() => {
    runSimulatedStart(rideId, driverUser).catch((err) => {
      console.warn(`[Simulation] Auto-start failed for ride ${rideId}:`, err.message);
    });
  }, delay);
}

async function runSimulatedStart(rideId, driverUser) {
  const ride = await Ride.findById(rideId).select("status driver");
  if (!ride || ride.status !== "accepted" || String(ride.driver) !== String(driverUser._id)) {
    console.log(`[Simulation] Ride ${rideId} is no longer this driver's accepted ride — skipping start`);
    return;
  }

  const rideService = require("./ride.service");
  await rideService.startRide(rideId, driverUser);
  console.log(`[Simulation] Driver ${driverUser._id} auto-started ride ${rideId}`);

  scheduleSimulatedComplete(rideId, driverUser);
}

function scheduleSimulatedComplete(rideId, driverUser) {
  const delay = randomDelay(COMPLETE_MIN_MS, COMPLETE_MAX_MS);
  console.log(`[Simulation] Driver ${driverUser._id} will complete ride ${rideId} in ~${Math.round(delay / 1000)}s`);

  setTimeout(() => {
    runSimulatedComplete(rideId, driverUser).catch((err) => {
      console.warn(`[Simulation] Auto-complete failed for ride ${rideId}:`, err.message);
    });
  }, delay);
}

async function runSimulatedComplete(rideId, driverUser) {
  const ride = await Ride.findById(rideId).select("status driver");
  if (!ride || ride.status !== "started" || String(ride.driver) !== String(driverUser._id)) {
    console.log(`[Simulation] Ride ${rideId} is no longer this driver's started ride — skipping complete`);
    return;
  }

  const rideService = require("./ride.service");
  // completeRide frees the driver back to "available" and (via
  // matchWaitingRideToDriver) immediately tries to match them to any ride
  // that was left waiting with nobody around — so a solo demo's simulated
  // drivers naturally cycle between requests without any extra wiring here.
  await rideService.completeRide(rideId, driverUser);
  console.log(`[Simulation] Driver ${driverUser._id} auto-completed ride ${rideId}`);
}

module.exports = { scheduleSimulatedAcceptance };
