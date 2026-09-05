import { useState } from "react";
import { Search, Info } from "lucide-react";
import Input from "../Input";
import Button from "../Button";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

// Temporary, clearly-labeled stand-in for real-time ride-request push — see
// README "Known Limitations": the Day 1-7 backend has no endpoint or socket
// event that tells an available driver a new ride exists to discover it by.
// A rider's dashboard/ride-details screen displays the ride's own ID, which
// can be typed in here; this calls the real, unmodified
// PATCH /api/rides/:id/accept endpoint — nothing about the accept flow
// itself is faked, only *how the driver learns the ID* is a manual
// substitute for the missing push notification.
export default function AcceptByIdCard({ onAccepted }) {
  const { showToast } = useToast();
  const [rideId, setRideId] = useState("");
  const [accepting, setAccepting] = useState(false);

  async function handleAccept(e) {
    e.preventDefault();
    if (!rideId.trim()) return;

    setAccepting(true);
    try {
      const res = await rideApi.acceptRide(rideId.trim());
      showToast("Ride accepted!", "success");
      onAccepted(res.data.data.ride);
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't accept that ride."), "error");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          The backend doesn't yet push new ride requests to available drivers in real time (see project README). As a
          stand-in for testing, paste a ride ID here — a rider can find it on their ride details screen — to accept it.
        </p>
      </div>
      <form onSubmit={handleAccept} className="mt-3 flex gap-2">
        <Input value={rideId} onChange={(e) => setRideId(e.target.value)} placeholder="Ride ID" className="flex-1" />
        <Button type="submit" icon={Search} loading={accepting} disabled={!rideId.trim()}>
          Accept
        </Button>
      </form>
    </div>
  );
}
