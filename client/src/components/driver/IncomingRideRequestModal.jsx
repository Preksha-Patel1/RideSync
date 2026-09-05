import { useState } from "react";
import { MapPin, Navigation, X, Check } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

// Presentational + wired to real endpoints, ready for the day
// `useIncomingRideRequest` actually receives something (see that hook's
// comment for the backend capability this depends on). `request` is
// expected to at least carry `{ rideId, pickup, destination, rider }`.
export default function IncomingRideRequestModal({ request, onAccepted, onDismiss }) {
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);

  if (!request) return null;

  async function handleAccept() {
    setProcessing(true);
    try {
      const res = await rideApi.acceptRide(request.rideId);
      onAccepted(res.data.data.ride);
    } catch (err) {
      showToast(getErrorMessage(err, "This ride is no longer available."), "error");
      onDismiss();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal open={Boolean(request)} onClose={onDismiss} title="New ride request">
      <div className="space-y-3">
        {request.rider?.name && <p className="text-sm text-slate-500">Rider: {request.rider.name}</p>}
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-slate-600">{request.pickup?.address}</span>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="text-slate-600">{request.destination?.address}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2.5">
        <Button variant="secondary" fullWidth icon={X} onClick={onDismiss} disabled={processing}>
          Reject
        </Button>
        <Button fullWidth icon={Check} loading={processing} onClick={handleAccept}>
          Accept Ride
        </Button>
      </div>
    </Modal>
  );
}
