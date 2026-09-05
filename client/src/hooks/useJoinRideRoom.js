import { useEffect } from "react";
import { getSocket, joinRideRoom } from "../services/socket";

// Joins the ride's Socket.IO room (server-side authorization happens in
// server/src/sockets/rideSocket.js — only the rider or the assigned driver
// is actually allowed in) whenever `rideId` is available and the socket is
// connected. Re-joins automatically after a reconnect, since Socket.IO does
// not remember room membership across a dropped connection (see backend
// README "Connection lifecycle" — the client is expected to re-join).
export function useJoinRideRoom(rideId) {
  useEffect(() => {
    if (!rideId) return undefined;

    const socket = getSocket();
    if (!socket) return undefined;

    if (socket.connected) {
      joinRideRoom(rideId);
    }

    const handleConnect = () => joinRideRoom(rideId);
    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [rideId]);
}
