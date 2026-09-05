import { useCallback, useState } from "react";
import { useSocketEvent } from "./useSocketEvent";

// Genuinely wired up, but dormant today: the Day 1-7 backend never emits a
// "new_ride_request" event to a driver — server/src/consumers/
// rideEventConsumer.js only ever broadcasts to a *ride's* room
// (`ride:<rideId>`), which a driver can't join before they know the ride
// exists. This hook exists so the moment that capability is added
// server-side (e.g. emitting to a `driver:<driverId>` room from the
// matching service), the incoming-request UI (IncomingRideRequestModal)
// starts working with zero changes here — see README "Known Limitations".
export function useIncomingRideRequest() {
  const [request, setRequest] = useState(null);

  useSocketEvent(
    "new_ride_request",
    useCallback((payload) => {
      setRequest(payload);
    }, [])
  );

  const clear = useCallback(() => setRequest(null), []);

  return { request, clear };
}
