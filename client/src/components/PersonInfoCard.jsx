import { Phone, Star } from "lucide-react";
import { initials } from "../utils/format";

// Shown for whichever counterpart (driver, on the rider's screen; rider, on
// the driver's screen) is populated on the ride. Name and phone come from
// the populated `User` document; vehicle and rating (driver only — a rider
// has neither) are attached separately by
// server/src/services/ride.service.js#populateRide from the Driver/Vehicle
// documents, so they're simply absent (and not rendered) on a rider's card.
export default function PersonInfoCard({ person, roleLabel }) {
  if (!person) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {initials(person.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{roleLabel}</p>
        <p className="truncate font-semibold text-slate-900">{person.name}</p>
        {(person.vehicle || typeof person.rating === "number") && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            {person.vehicle && (
              <span className="truncate">
                {person.vehicle.brand} {person.vehicle.model} · {person.vehicle.registrationNumber}
              </span>
            )}
            {typeof person.rating === "number" && (
              <span className="flex shrink-0 items-center gap-0.5 font-semibold text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {person.rating.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
      {person.phone && (
        <a
          href={`tel:${person.phone}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          aria-label={`Call ${person.name}`}
        >
          <Phone className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
