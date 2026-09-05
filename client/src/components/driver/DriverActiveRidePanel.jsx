import { useCallback, useEffect, useState } from "react";
import { MapPin, Navigation, PlayCircle, CheckCircle2 } from "lucide-react";
import MapView from "../MapView";
import RideStatusTimeline from "../RideStatusTimeline";
import PersonInfoCard from "../PersonInfoCard";
import Button from "../Button";
import { useJoinRideRoom } from "../../hooks/useJoinRideRoom";
import { sendDriverLocation } from "../../services/socket";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const LOCATION_BROADCAST_INTERVAL_MS = 4000;

function toLatLng(point) {
  if (!point?.location?.coordinates) return null;
  const [longitude, latitude] = point.location.coordinates;
  return { latitude, longitude };
}

// The driver's view of their currently assigned ride (status `accepted` or
// `started`). While active, periodically reads the browser's real GPS
// position and emits it over the existing `driver_location_update` socket
// event (server/src/sockets/rideSocket.js) — the same throttled, Redis-only
// path Day 6 built; this is simply the browser-side counterpart that
// actually calls navigator.geolocation instead of a test script.
export default function DriverActiveRidePanel({ ride, onRideChange }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [myLocation, setMyLocation] = useState(null);

  useJoinRideRoom(ride._id);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    const broadcast = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMyLocation({ latitude, longitude });
          sendDriverLocation(ride._id, latitude, longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    broadcast();
    const interval = setInterval(broadcast, LOCATION_BROADCAST_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ride._id]);

  const handleStart = useCallback(async () => {
    setBusy(true);
    try {
      const res = await rideApi.startRide(ride._id);
      onRideChange(res.data.data.ride);
      showToast("Ride started.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't start this ride."), "error");
    } finally {
      setBusy(false);
    }
  }, [ride._id, onRideChange, showToast]);

  const handleComplete = useCallback(async () => {
    setBusy(true);
    try {
      const res = await rideApi.completeRide(ride._id);
      onRideChange(res.data.data.ride);
      showToast("Ride completed.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't complete this ride."), "error");
    } finally {
      setBusy(false);
    }
  }, [ride._id, onRideChange, showToast]);

  const pickupPoint = toLatLng(ride.pickup);
  const destinationPoint = toLatLng(ride.destination);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <RideStatusTimeline status={ride.status} />

          <div className="mt-4">
            <PersonInfoCard person={ride.rider} roleLabel="Rider" />
          </div>

          <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="text-slate-600">{ride.pickup.address}</span>
            </div>
            <div className="flex items-start gap-2">
              <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span className="text-slate-600">{ride.destination.address}</span>
            </div>
          </div>

          <div className="mt-5">
            {ride.status === "accepted" && (
              <Button fullWidth size="lg" icon={PlayCircle} loading={busy} onClick={handleStart}>
                Start Ride
              </Button>
            )}
            {ride.status === "started" && (
              <Button fullWidth size="lg" icon={CheckCircle2} loading={busy} onClick={handleComplete}>
                Complete Ride
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <MapView
          center={myLocation || pickupPoint}
          pickup={pickupPoint}
          destination={destinationPoint}
          driverLocation={myLocation}
          className="h-80 w-full lg:h-full lg:min-h-[420px]"
        />
      </div>
    </div>
  );
}
