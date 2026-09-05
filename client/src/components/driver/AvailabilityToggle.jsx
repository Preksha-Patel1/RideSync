import { useState } from "react";
import { Power, LocateFixed } from "lucide-react";
import Button from "../Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import * as driverApi from "../../services/driverApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

// "busy" is a server-controlled state (set automatically when a ride is
// accepted, cleared on completion/cancellation — see
// server/src/services/ride.service.js). It is deliberately not a toggle
// option here: a driver mid-ride can't flip themselves back to available or
// offline from this control, matching what the backend actually allows.
export default function AvailabilityToggle({ status, onStatusChange }) {
  const { showToast } = useToast();
  const { coords, requestLocation } = useGeolocation();
  const [updating, setUpdating] = useState(false);

  const isOnline = status === "available";
  const isBusy = status === "busy";

  async function goOnline() {
    setUpdating(true);
    try {
      // A driver needs a real location on record before they can be
      // matched to any ride (server/src/services/matching.service.js), so
      // going online also reports current location if the browser allows
      // it — falling back silently to "no location yet" if denied, exactly
      // like the existing REST endpoint already tolerates (Driver.currentLocation
      // simply stays at its default until an update succeeds).
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                await driverApi.updateDriverLocation([position.coords.longitude, position.coords.latitude]);
              } catch {
                // Non-fatal — see comment above.
              }
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      const res = await driverApi.updateDriverStatus("available");
      onStatusChange(res.data.data.driver.status);
      showToast("You're online and ready to receive rides.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't update your status."), "error");
    } finally {
      setUpdating(false);
    }
  }

  async function goOffline() {
    setUpdating(true);
    try {
      const res = await driverApi.updateDriverStatus("offline");
      onStatusChange(res.data.data.driver.status);
      showToast("You're offline.", "info");
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't update your status."), "error");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-6 shadow-card transition-colors ${
        isOnline ? "border-emerald-200 bg-emerald-50/60" : isBusy ? "border-brand-200 bg-brand-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-xl font-extrabold ${isOnline ? "text-emerald-700" : isBusy ? "text-brand-700" : "text-slate-900"}`}>
            {isBusy ? "You're on a ride" : isOnline ? "You're Online" : "You're Offline"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isBusy
              ? "Finish your current ride to go back online."
              : isOnline
                ? "You're ready to receive rides."
                : "Go online to start receiving ride requests."}
          </p>
        </div>

        {!isBusy && (
          <Button
            variant={isOnline ? "secondary" : "primary"}
            icon={isOnline ? Power : LocateFixed}
            loading={updating}
            onClick={isOnline ? goOffline : goOnline}
          >
            {isOnline ? "Go Offline" : "Go Online"}
          </Button>
        )}
      </div>
    </div>
  );
}
