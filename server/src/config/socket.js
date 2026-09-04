const { Server } = require("socket.io");
const socketAuthenticate = require("../middleware/socketAuth.middleware");
const registerRideSocketHandlers = require("../sockets/rideSocket");

// Module-scoped, not exported directly: consumers/rideEventConsumer.js needs
// to reach this instance to bridge Kafka events into socket-room broadcasts,
// but only after initSocket() has actually run — see getIO() below.
let io = null;

// Attaches Socket.IO to the *existing* HTTP server (passed in from
// server.js) rather than standing up a second server on its own port — one
// process, one port, two protocols layered on the same TCP connection:
// plain HTTP for REST, upgraded to WebSocket (or long-polling as a
// fallback) for real-time. socket.io does this automatically once given a
// Node http.Server instance.
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      // Mirrors app.js's permissive `cors()` default — fine for local
      // development, same as the rest of this project's REST CORS setup.
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Runs once per connection attempt, before "connection" fires — rejecting
  // here means the client never gets a connected socket at all instead of
  // connecting first and being kicked out afterward.
  io.use(socketAuthenticate);

  io.on("connection", (socket) => {
    console.log(`Socket connected: user ${socket.user.id} (${socket.user.role})`);

    registerRideSocketHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      // Network drops and app backgrounding are routine on mobile — a
      // disconnect here does not mean the ride ended or anything went
      // wrong; the client is expected to reconnect and re-join its ride
      // room (see README "Connection lifecycle"). No ride/business state
      // changes as a result of a disconnect by itself.
      console.log(`Socket disconnected: user ${socket.user.id} (${reason})`);
    });
  });

  console.log("Socket.IO initialized");
  return io;
}

// Returns null until initSocket() has run. Callers (the Kafka consumer)
// must treat a null return as "not ready yet" and skip broadcasting rather
// than throwing — consistent with how every other optional dependency in
// this project (Redis, Kafka itself) degrades.
function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
