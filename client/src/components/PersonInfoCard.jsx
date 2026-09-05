import { Phone } from "lucide-react";
import { initials } from "../utils/format";

// Shown for whichever counterpart (driver, on the rider's screen; rider, on
// the driver's screen) is populated on the ride. Deliberately shows only
// name and phone — the two fields actually present on the populated `User`
// document (server/src/services/ride.service.js#populateRide populates
// `driver`/`rider` from the User model, minus password). There is no
// vehicle-details-per-ride or rating field anywhere in the Day 1-7 backend,
// so this never fabricates either — see README "Known Limitations".
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
