import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Navigation, XCircle, ArrowRight } from "lucide-react";
import MapView from "../MapView";
import RideStatusTimeline from "../RideStatusTimeline";
import PersonInfoCard from "../PersonInfoCard";
import Button from "../Button";
import { useLiveRide } from "../../hooks/useLiveRide";
import { useToast } from "../../context/ToastContext";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";

const STATUS_COPY = {
  requested: { title: "Finding the best driver for you...", description: "Hang tight — we're matching you with a nearby driver." },
  accepted: { title: "Your driver is on the way", description: "Track their location live below." },
  started: { title: "Your ride is in progress", description: "Sit back and enjoy the ride." },
};

function toLatLng(point) {
  if (!point?.location?.coordinates) return null;
  const [longitude, latitude] = point.location.coordinates;
  return { latitude, longitude };
}

// The rider dashboard's centerpiece while a ride is active (requested,
// accepted, or started) — replaces the booking form entirely, per the
// state-based UI the brief asks for (searching -> driver found -> arriving
// -> started -> completed).
export default function ActiveRidePanel({ ride, onRideChange, onCancelled }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

  const handleRideUpdate = useCallback(
    (updatedRide) => {
      onRideChange(() => updatedRide);
      if (updatedRide.status === "completed") {
        showToast("You've arrived! Head to payment to finish up.", "success");
      } else if (updatedRide.status === "cancelled") {
        showToast("This ride was cancelled.", "info");
      }
    },
    [onRideChange, showToast]
  );

  const { driverLocation } = useLiveRide(ride._id, { onRideUpdate: handleRideUpdate });

  async function handleCancel() {
    setCancelling(true);
    try {
      await rideApi.cancelRide(ride._id);
      showToast("Ride cancelled.", "info");
      onCancelled();
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't cancel this ride."), "error");
    } finally {
      setCancelling(false);
    }
  }

  const pickupPoint = toLatLng(ride.pickup);
  const destinationPoint = toLatLng(ride.destination);
  const copy = STATUS_COPY[ride.status];
  const canCancel = ride.status === "requested" || ride.status === "accepted";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <RideStatusTimeline status={ride.status} />

          <div className="mt-6">
            {ride.status === "requested" && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-500" />
                <div>
                  <p className="font-semibold text-slate-900">{copy.title}</p>
                  <p className="text-sm text-slate-500">{copy.description}</p>
                </div>
              </div>
            )}
            {copy && ride.status !== "requested" && (
              <div>
                <p className="font-semibold text-slate-900">{copy.title}</p>
                <p className="text-sm text-slate-500">{copy.description}</p>
              </div>
            )}

            {ride.status === "completed" && (
              <div>
                <p className="font-semibold text-emerald-700">You've arrived!</p>
                <p className="text-sm text-slate-500">Your ride is complete. Continue to payment.</p>
              </div>
            )}
          </div>

          {ride.driver && (
            <div className="mt-4">
              <PersonInfoCard person={ride.driver} roleLabel="Your driver" />
            </div>
          )}

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

          <div className="mt-5 flex flex-col gap-2.5">
            {ride.status === "completed" && (
              <Button fullWidth icon={ArrowRight} onClick={() => navigate(`/rider/ride/${ride._id}`)}>
                Continue to payment
              </Button>
            )}
            {canCancel && (
              <Button fullWidth variant="secondary" icon={XCircle} loading={cancelling} onClick={handleCancel}>
                Cancel ride
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <MapView
          center={pickupPoint}
          pickup={pickupPoint}
          destination={destinationPoint}
          driverLocation={driverLocation}
          className="h-80 w-full lg:h-full lg:min-h-[420px]"
        />
      </div>
    </div>
  );
}
