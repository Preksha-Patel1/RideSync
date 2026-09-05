import { io } from "socket.io-client";

// Matches server/src/config/socket.js exactly: the JWT is sent once, in the
// handshake (`socket.handshake.auth.token`), verified by
// socketAuth.middleware.js — not as a per-message header the way REST works.
// One module-level singleton is intentional: every component that needs the
// socket (rider dashboard, ride tracking, driver dashboard) shares the same
// connection and its room memberships, rather than each opening its own.
let socket = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5050";

export function connectSocket(token) {
  // Checking for an existing instance at all (connected or still
  // connecting) — not just `socket.connected` — matters under React 18
  // StrictMode's dev-only double-invoke of effects: without this, the
  // second invocation would see a not-yet-connected socket and open a
  // second connection before the first one settles.
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Client -> server events (server/src/config/constants.js SOCKET_EVENTS.clientToServer)
export function joinRideRoom(rideId) {
  socket?.emit("join_ride", { rideId });
}

export function sendDriverLocation(rideId, latitude, longitude) {
  socket?.emit("driver_location_update", { rideId, latitude, longitude });
}
