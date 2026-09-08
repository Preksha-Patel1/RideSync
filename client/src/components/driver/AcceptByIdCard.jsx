import { useState } from "react";
import { Search, Info } from "lucide-react";
import Input from "../Input";
import Button from "../Button";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

// A fallback alongside the real-time push (IncomingRideRequestModal /
// useIncomingRideRequest): that notification only reaches the *one* driver
// matching.service.js picked as nearest at request time (Day 3's
// `matchedDriver` is advisory, singular, and never sent at all if no driver
// was in range — see server/src/services/matching.service.js). Any other
// available driver — or that same driver if they missed the popup — can
// still accept by pasting the ride's id here, which a rider's screen always
// displays. Calls the real, unmodified PATCH /api/rides/:id/accept endpoint.
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
          Didn't get a request popup? Only the single nearest driver gets notified automatically. Paste a ride ID
          here — a rider can find it on their ride details screen — to accept it anyway.
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
