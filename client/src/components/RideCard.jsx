import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, ChevronRight } from "lucide-react";
import Badge from "./Badge";
import { formatShortDate, formatCurrency } from "../utils/format";
import { rideStatusMeta } from "../utils/statusMeta";

// One ride row for the history list, shared by both the rider and driver
// history pages — `role` decides whether the counterpart shown is the
// driver or the rider, since server/src/services/ride.service.js#getMyRides
// returns the same Ride shape to both, populated with both `rider` and
// `driver`.
export default function RideCard({ ride, role }) {
  const navigate = useNavigate();
  const meta = rideStatusMeta(ride.status);
  const counterpart = role === "driver" ? ride.rider : ride.driver;
  const counterpartLabel = role === "driver" ? "Rider" : "Driver";

  return (
    <button
      type="button"
      onClick={() => navigate(`/${role}/ride/${ride._id}`)}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card transition-all hover:border-brand-200 hover:shadow-soft sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>{formatShortDate(ride.createdAt)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{counterpartLabel}: {counterpart?.name || "Not assigned"}</span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p className="truncate text-sm font-medium text-slate-700">{ride.pickup?.address}</p>
            </div>
            <div className="flex items-start gap-2">
              <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <p className="truncate text-sm font-medium text-slate-700">{ride.destination?.address}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge label={meta.label} className={meta.badge} />
          <p className="text-sm font-bold text-slate-900">{ride.fare ? formatCurrency(ride.fare) : "—"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2.5 text-xs font-semibold text-brand-600">
        View details
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
