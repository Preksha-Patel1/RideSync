const { FARE_CONFIG } = require("../config/constants");
const ApiError = require("../utils/ApiError");

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Great-circle (straight-line) distance between two GeoJSON [longitude,
// latitude] points, via the Haversine formula. This is deliberately not
// road/routing distance — that would need a routing API (Google/Mapbox/
// OSRM), explicitly out of scope for Day 7's learning goals. A straight
// line is a reasonable approximation for a simulated fare.
function calculateDistanceKm([lon1, lat1], [lon2, lat2]) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// The only inputs are the ride's own persisted data (pickup/destination
// coordinates, startedAt/completedAt) — never anything from the client.
// This is what "the backend calculates the fare" means concretely: there is
// no code path anywhere that lets a request body's `amount`/`distance`/
// `duration` field influence the number this function returns.
function calculateFare(ride) {
  if (!ride.startedAt || !ride.completedAt) {
    throw new ApiError(400, "Ride must have both startedAt and completedAt to calculate a fare");
  }

  const distanceKm = calculateDistanceKm(ride.pickup.location.coordinates, ride.destination.location.coordinates);
  const durationMinutes = (ride.completedAt.getTime() - ride.startedAt.getTime()) / 60000;

  const rawFare = FARE_CONFIG.baseFare + distanceKm * FARE_CONFIG.perKm + durationMinutes * FARE_CONFIG.perMinute;

  return {
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    durationMinutes: Math.round(durationMinutes * 100) / 100,
    // Money is rounded to 2 decimal places, same as any currency amount.
    fare: Math.round(rawFare * 100) / 100,
  };
}

module.exports = { calculateDistanceKm, calculateFare };
