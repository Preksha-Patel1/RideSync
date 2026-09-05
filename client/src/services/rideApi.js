import api from "./api";

// Maps 1:1 to server/src/routes/ride.routes.js. `pickup`/`destination` must
// each be { address, location: { type: "Point", coordinates: [lng, lat] } }
// — server/src/models/Ride.js's locationSchema — validated server-side by
// express-validator (longitude -180..180, latitude -90..90).
export function createRide({ pickup, destination }) {
  return api.post("/rides", { pickup, destination });
}

export function getRide(rideId) {
  return api.get(`/rides/${rideId}`);
}

export function getMyRides({ page = 1, limit = 10 } = {}) {
  return api.get("/rides/my-rides", { params: { page, limit } });
}

export function acceptRide(rideId) {
  return api.patch(`/rides/${rideId}/accept`);
}

export function startRide(rideId) {
  return api.patch(`/rides/${rideId}/start`);
}

export function completeRide(rideId) {
  return api.patch(`/rides/${rideId}/complete`);
}

// server/src/services/ride.service.js#cancelRide reads only (rideId, user)
// — it never inspects the request body — so no reason is actually sent to
// the backend today; it exists here purely as a documented no-op parameter
// in case a future backend change starts persisting it.
export function cancelRide(rideId) {
  return api.patch(`/rides/${rideId}/cancel`);
}
