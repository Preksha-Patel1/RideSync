import { Check } from "lucide-react";
import { RIDE_STEPS, rideStatusMeta } from "../utils/statusMeta";

const STEP_LABELS = {
  requested: "Requested",
  accepted: "Accepted",
  started: "In progress",
  completed: "Completed",
};

// A visual progress stepper for the ride lifecycle
// (requested -> accepted -> started -> completed), matching the exact state
// machine in server/src/services/ride.service.js's VALID_TRANSITIONS.
// Renders a distinct "cancelled" treatment instead of a step position, since
// cancellation can happen from either `requested` or `accepted` and isn't a
// point on this line.
export default function RideStatusTimeline({ status }) {
  if (status === "cancelled") {
    const meta = rideStatusMeta("cancelled");
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${meta.badge}`}>
        {meta.label}
      </div>
    );
  }

  const currentIndex = RIDE_STEPS.indexOf(status);

  return (
    <div className="flex items-center">
      {RIDE_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === RIDE_STEPS.length - 1;

        return (
          <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? "bg-brand-600 text-white"
                    : isCurrent
                      ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`text-[11px] font-medium ${isCurrent ? "text-brand-700" : "text-slate-400"}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-colors ${isDone ? "bg-brand-600" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
