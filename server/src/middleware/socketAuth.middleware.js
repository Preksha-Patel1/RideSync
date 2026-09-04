const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Conceptually the same JWT check as auth.middleware.js's authenticate(),
// just delivered differently. REST re-reads `Authorization: Bearer <token>`
// on every single request; a socket authenticates once, during the initial
// handshake (`socket.handshake.auth.token`), and the connection stays
// authenticated for its whole lifetime — there's no per-message
// re-authentication the way REST re-checks the header on every call. This
// reuses the exact same JWT_SECRET and User lookup as the REST middleware
// rather than standing up a second, parallel auth system.
async function socketAuthenticate(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error("Invalid or expired authentication token"));
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return next(new Error("User belonging to this token no longer exists"));
    }

    // Only what socket handlers actually need to authorize ride-room access
    // and location updates — never the full Mongoose document.
    socket.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
}

module.exports = socketAuthenticate;
