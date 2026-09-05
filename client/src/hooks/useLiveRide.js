import { useCallback, useState } from "react";
import { useJoinRideRoom } from "./useJoinRideRoom";
import { useSocketEvent } from "./useSocketEvent";
import { useToast } from "../context/ToastContext";
import * as rideApi from "../services/rideApi";

// Shared by every screen that needs to watch one ride live: the rider
// dashboard's active-ride panel, the rider/driver ride-details pages, and
// the driver's active-ride view. Joins that ride's Socket.IO room and wires
// up the events server/src/sockets/rideSocket.js and consumers/
// rideEventConsumer.js + paymentEventConsumer.js can emit for it.
//
// On `ride_status_updated`, this re-fetches the full ride via GET
// /api/rides/:id rather than only patching the `status` string locally —
// a transition also populates fields the status alone doesn't carry
// (`driver` on acceptance, `startedAt`/`completedAt` on start/complete), and
// a partial local patch would silently leave those stale (e.g. the rider's
// screen never learning who the driver is after "accepted"). `onRideUpdate`
// receives the complete, freshly-fetched ride document.
export function useLiveRide(rideId, { onRideUpdate, onPaymentUpdate } = {}) {
  const { showToast } = useToast();
  const [driverLocation, setDriverLocation] = useState(null);

  useJoinRideRoom(rideId);

  useSocketEvent(
    "ride_status_updated",
    useCallback(
      async (payload) => {
        if (payload.rideId !== rideId) return;
        try {
          const res = await rideApi.getRide(rideId);
          onRideUpdate?.(res.data.data.ride);
        } catch {
          // Non-fatal: the ride's own screen already polls/loads on mount,
          // and a future event (or a manual refresh) will catch it up. A
          // real-time refresh failing must never surface as a hard error.
        }
      },
      [rideId, onRideUpdate]
    )
  );

  useSocketEvent(
    "driver_location_updated",
    useCallback(
      (payload) => {
        if (payload.rideId !== rideId) return;
        setDriverLocation(payload.location);
      },
      [rideId]
    )
  );

  useSocketEvent(
    "payment_status_updated",
    useCallback(
      (payload) => {
        if (payload.rideId !== rideId) return;
        onPaymentUpdate?.(payload);
      },
      [rideId, onPaymentUpdate]
    )
  );

  useSocketEvent(
    "ride_error",
    useCallback(
      (payload) => {
        showToast(payload.message || "A real-time update couldn't be processed.", "error");
      },
      [showToast]
    )
  );

  return { driverLocation };
}
