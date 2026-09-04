const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const driverService = require("../services/driver.service");
const { SOCKET_EVENTS } = require("../config/constants");

const ACTIVE_RIDE_STATUSES = ["accepted", "started"];

// Basic flood protection (Day 6 scope: "keep this simple", not a production
// rate limiter): per-driver, in-memory, process-local. A driver's GPS can
// tick every second or faster; there's no reason to process and re-broadcast
// every single one. This is exactly the kind of ephemeral runtime state that
// belongs in memory, not MongoDB or even Redis — it doesn't need to survive
// a restart, and it's meaningless to any other server process (see README
// "What changes with multiple server instances" for why this specific
// design choice stops being enough once RideSync runs on more than one
// server: each instance would track its own throttle independently).
const lastLocationUpdateAt = new Map();
const MIN_LOCATION_UPDATE_INTERVAL_MS = 2000;

function emitError(socket, message) {
  socket.emit(SOCKET_EVENTS.serverToClient.rideError, { message });
}

// Registers this connection's ride-related event handlers. Called once per
// authenticated socket (see config/socket.js) — socket.user is already
// populated by socketAuth.middleware.js by the time this runs.
function registerRideSocketHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.clientToServer.joinRide, async (payload = {}) => {
    try {
      const { rideId } = payload;

      if (!rideId || !mongoose.isValidObjectId(rideId)) {
        return emitError(socket, "Invalid ride id");
      }

      const ride = await Ride.findById(rideId);
      if (!ride) {
        return emitError(socket, "Ride not found");
      }

      // Same ownership rule as REST's getRideById/cancelRide: only the
      // rider or the assigned driver may see this ride's activity. A random
      // authenticated user must not be able to join and listen in on
      // someone else's ride room.
      const userId = socket.user.id;
      const isRider = ride.rider.toString() === userId;
      const isAssignedDriver = Boolean(ride.driver) && ride.driver.toString() === userId;

      if (!isRider && !isAssignedDriver) {
        return emitError(socket, "You are not authorized to join this ride");
      }

      socket.join(`ride:${rideId}`);
      socket.emit(SOCKET_EVENTS.serverToClient.rideJoined, { rideId });
    } catch (err) {
      emitError(socket, "Failed to join ride");
    }
  });

  socket.on(SOCKET_EVENTS.clientToServer.driverLocationUpdate, async (payload = {}) => {
    try {
      const { rideId, latitude, longitude } = payload;

      if (socket.user.role !== "driver") {
        return emitError(socket, "Only drivers can send location updates");
      }

      if (!rideId || !mongoose.isValidObjectId(rideId)) {
        return emitError(socket, "Invalid ride id");
      }

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return emitError(socket, "Invalid coordinates");
      }

      const ride = await Ride.findById(rideId);
      if (!ride) {
        return emitError(socket, "Ride not found");
      }

      if (!ride.driver || ride.driver.toString() !== socket.user.id) {
        return emitError(socket, "You are not the assigned driver for this ride");
      }

      if (!ACTIVE_RIDE_STATUSES.includes(ride.status)) {
        return emitError(socket, `Cannot update location for a ride that is ${ride.status}`);
      }

      const lastUpdate = lastLocationUpdateAt.get(socket.user.id) || 0;
      if (Date.now() - lastUpdate < MIN_LOCATION_UPDATE_INTERVAL_MS) {
        // Not an error — the driver's client isn't doing anything wrong by
        // sampling GPS frequently. This just silently drops the excess
        // instead of processing (and re-broadcasting) every single one.
        return;
      }
      lastLocationUpdateAt.set(socket.user.id, Date.now());

      // Redis-only — see driver.service.js#updateLiveLocation for why this
      // deliberately never touches MongoDB.
      await driverService.updateLiveLocation(rideId, { latitude, longitude });

      io.to(`ride:${rideId}`).emit(SOCKET_EVENTS.serverToClient.driverLocationUpdated, {
        event: SOCKET_EVENTS.serverToClient.driverLocationUpdated,
        rideId,
        driverId: socket.user.id,
        location: { latitude, longitude },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      emitError(socket, "Failed to process location update");
    }
  });

  socket.on("disconnect", () => {
    lastLocationUpdateAt.delete(socket.user.id);
  });
}

module.exports = registerRideSocketHandlers;
