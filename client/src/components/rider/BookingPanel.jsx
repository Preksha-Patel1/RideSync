import { useEffect, useState } from "react";
import { MapPin, Navigation, LocateFixed, Search } from "lucide-react";
import MapView, { DEMO_CITY_CENTER } from "../MapView";
import Input from "../Input";
import Button from "../Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const emptyPoint = { address: "", coordinates: null };

// The rider-facing booking form. No paid map/geocoding API is configured
// (see MapView.jsx), so real coordinates come from either the browser's own
// Geolocation API (for "current location" as pickup) or tapping the map
// placeholder — never fabricated. The address text field is what the rider
// actually reads; the coordinates are what the backend actually validates
// and stores (server/src/models/Ride.js).
export default function BookingPanel({ onRideCreated }) {
  const { showToast } = useToast();
  const { coords, requestLocation } = useGeolocation();

  const [pickup, setPickup] = useState(emptyPoint);
  const [destination, setDestination] = useState(emptyPoint);
  const [activeField, setActiveField] = useState("pickup");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (coords) {
      setPickup((prev) => ({
        address: prev.address || "Current location",
        coordinates: coords,
      }));
    }
  }, [coords]);

  function handlePick(point, field) {
    if (field === "pickup") {
      setPickup((prev) => ({ address: prev.address, coordinates: point }));
      setActiveField("destination");
    } else {
      setDestination((prev) => ({ address: prev.address, coordinates: point }));
    }
  }

  const canSubmit =
    pickup.address.trim() && pickup.coordinates && destination.address.trim() && destination.coordinates;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await rideApi.createRide({
        pickup: {
          address: pickup.address.trim(),
          location: { type: "Point", coordinates: [pickup.coordinates.longitude, pickup.coordinates.latitude] },
        },
        destination: {
          address: destination.address.trim(),
          location: {
            type: "Point",
            coordinates: [destination.coordinates.longitude, destination.coordinates.latitude],
          },
        },
      });
      onRideCreated(res.data.data.ride);
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't process your ride request. Please try again."), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const mapCenter = pickup.coordinates || DEMO_CITY_CENTER;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={handleSubmit} className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-slate-900">Book your ride</h2>
          <p className="mt-1 text-sm text-slate-500">Set your pickup and destination to find a nearby driver.</p>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setActiveField("pickup")}
              className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                activeField === "pickup" ? "border-brand-500 bg-brand-50/50" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <MapPin className="h-3.5 w-3.5" /> PICKUP
              </div>
              <Input
                value={pickup.address}
                onChange={(e) => setPickup((prev) => ({ ...prev, address: e.target.value }))}
                onFocus={() => setActiveField("pickup")}
                placeholder="e.g. Home, Office..."
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-slate-400">
                {pickup.coordinates ? `${pickup.coordinates.latitude.toFixed(4)}, ${pickup.coordinates.longitude.toFixed(4)}` : "Tap the map or use current location"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveField("destination")}
              className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                activeField === "destination" ? "border-brand-500 bg-brand-50/50" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-600">
                <Navigation className="h-3.5 w-3.5" /> DESTINATION
              </div>
              <Input
                value={destination.address}
                onChange={(e) => setDestination((prev) => ({ ...prev, address: e.target.value }))}
                onFocus={() => setActiveField("destination")}
                placeholder="Where to?"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-slate-400">
                {destination.coordinates
                  ? `${destination.coordinates.latitude.toFixed(4)}, ${destination.coordinates.longitude.toFixed(4)}`
                  : "Tap the map to set"}
              </p>
            </button>

            <Button type="button" variant="ghost" size="sm" icon={LocateFixed} onClick={requestLocation}>
              Use my current location for pickup
            </Button>
          </div>

          <Button type="submit" fullWidth size="lg" className="mt-5" disabled={!canSubmit} loading={submitting} icon={Search}>
            Request Ride
          </Button>
        </div>
      </form>

      <div className="lg:col-span-3">
        <MapView
          center={mapCenter}
          pickup={pickup.coordinates}
          destination={destination.coordinates}
          interactive
          activeField={activeField}
          onPick={handlePick}
          className="h-80 w-full lg:h-full lg:min-h-[420px]"
        />
      </div>
    </div>
  );
}
