import { useState } from "react";
import { Power, LocateFixed } from "lucide-react";
import Button from "../Button";
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
  const [updating, setUpdating] = useState(false);

  const isOnline = status === "available";
  const isBusy = status === "busy";

  async function goOnline() {
    setUpdating(true);
    try {
      // A driver needs a real location on record before they can be matched
      // to any ride (server/src/services/matching.service.js) — going online
      // without one leaves the driver stuck at whatever stale/default
      // coordinates they last had, silently invisible to matching with no
      // indication anything is wrong. So this blocks on getting a real fix
      // first, rather than tolerating a denial/timeout and reporting success
      // anyway.
      if (!navigator.geolocation) {
        showToast("This browser doesn't support location — you can't go online without it.", "error");
        return;
      }
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve([position.coords.longitude, position.coords.latitude]),
          (err) => reject(new Error(err.message || "Unable to retrieve your location")),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
      await driverApi.updateDriverLocation(coords);
      const res = await driverApi.updateDriverStatus("available");
      onStatusChange(res.data.data.driver.status);
      showToast("You're online and ready to receive rides.", "success");
    } catch (err) {
      showToast(
        err.message && !err.response
          ? `Couldn't get your location: ${err.message}. Allow location access and try again.`
          : getErrorMessage(err, "We couldn't update your status."),
        "error"
      );
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
