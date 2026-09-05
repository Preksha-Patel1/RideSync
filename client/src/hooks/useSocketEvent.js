import { useEffect, useRef } from "react";
import { getSocket } from "../services/socket";

// Subscribes to one Socket.IO event for the lifetime of the calling
// component and unsubscribes on unmount — the exact cleanup the brief calls
// out as important, done once here instead of every screen remembering to
// pair its own socket.on with a socket.off.
//
// `handler` is kept in a ref so callers don't need to useCallback it
// themselves to avoid resubscribing every render; only a change to
// `eventName` (or the socket instance appearing after a delayed connect)
// re-runs the effect.
export function useSocketEvent(eventName, handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const listener = (payload) => handlerRef.current(payload);
    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, [eventName]);
}
