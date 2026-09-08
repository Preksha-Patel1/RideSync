import { useCallback, useState } from "react";
import { useSocketEvent } from "./useSocketEvent";

// Listens for "new_ride_request", pushed by server/src/consumers/
// rideEventConsumer.js to a driver's personal `driver:<userId>` room
// (auto-joined on connect — see server/src/config/socket.js) whenever that
// driver is the nearest-match candidate for a newly requested ride. Purely
// advisory, same as `Ride.matchedDriver` itself (Day 3): any available
// driver can still accept, this is just how the matched one finds out.
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
