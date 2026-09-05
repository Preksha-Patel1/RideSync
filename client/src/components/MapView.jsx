import { useCallback, useRef } from "react";
import { MapPin, Navigation, Car } from "lucide-react";

// No paid map provider is configured anywhere in this project (see README
// "Known Limitations"), so this renders a stylized, CSS/SVG map-like surface
// instead — real geography is not represented, only a small fixed-size
// coordinate window around `center`, used purely so pickup/destination/
// driver markers have somewhere honest to live and (in interactive mode) so
// a rider can actually produce real coordinates to send to the backend by
// clicking, rather than the app fabricating them.
//
// The props are intentionally geography-shaped (lat/lng in, pixel math
// entirely internal) so a real provider (Mapbox GL, Google Maps,
// react-leaflet) could later replace only this file's internals — every
// caller (BookingPanel, RideTrackingPanel, driver active-ride view) would
// keep working unchanged against the same { center, pickup, destination,
// driverLocation, interactive, activeField, onPick } contract.
const DEGREE_SPAN = 0.06; // ~6.5km window shown in each direction

function toPercent(value, center, span) {
  const pct = ((value - (center - span)) / (span * 2)) * 100;
  return Math.min(100, Math.max(0, pct));
}

function Marker({ leftPct, topPct, icon: Icon, color, label, pulse }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full transition-all duration-500 ease-out"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <div className="flex flex-col items-center">
        <div className={`relative flex h-8 w-8 items-center justify-center rounded-full shadow-soft ${color}`}>
          {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-40`} />}
          <Icon className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        {label && (
          <span className="mt-1 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-card">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MapView({
  center,
  pickup,
  destination,
  driverLocation,
  interactive = false,
  activeField = "destination",
  onPick,
  className = "",
}) {
  const containerRef = useRef(null);

  const handleClick = useCallback(
    (e) => {
      if (!interactive || !onPick || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const xPct = (e.clientX - rect.left) / rect.width;
      const yPct = (e.clientY - rect.top) / rect.height;

      const longitude = center.longitude - DEGREE_SPAN + xPct * DEGREE_SPAN * 2;
      const latitude = center.latitude + DEGREE_SPAN - yPct * DEGREE_SPAN * 2;

      onPick({ latitude, longitude }, activeField);
    },
    [interactive, onPick, center, activeField]
  );

  const project = (point) => {
    if (!point) return null;
    return {
      leftPct: toPercent(point.longitude, center.longitude, DEGREE_SPAN),
      topPct: 100 - toPercent(point.latitude, center.latitude, DEGREE_SPAN),
    };
  };

  const pickupPos = project(pickup);
  const destPos = project(destination);
  const driverPos = project(driverLocation);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role={interactive ? "button" : "img"}
      aria-label={interactive ? `Tap to set ${activeField}` : "Map preview"}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${interactive ? "cursor-crosshair" : ""} ${className}`}
    >
      {/* Stylized "streets" backdrop — pure CSS, no external tiles/imagery */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#eef1f6",
          backgroundImage:
            "linear-gradient(#dfe4ee 1px, transparent 1px), linear-gradient(90deg, #dfe4ee 1px, transparent 1px), linear-gradient(#e7ebf3 1px, transparent 1px), linear-gradient(90deg, #e7ebf3 1px, transparent 1px)",
          backgroundSize: "88px 88px, 88px 88px, 22px 22px, 22px 22px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />

      {pickupPos && <Marker {...pickupPos} icon={MapPin} color="bg-emerald-500" label="Pickup" />}
      {destPos && <Marker {...destPos} icon={Navigation} color="bg-brand-600" label="Drop" />}
      {driverPos && <Marker {...driverPos} icon={Car} color="bg-ink-900" label="Driver" pulse />}

      {interactive && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-card">
          Tap the map to set {activeField}
        </div>
      )}
    </div>
  );
}

export const DEMO_CITY_CENTER = { latitude: 23.0225, longitude: 72.5714 };
