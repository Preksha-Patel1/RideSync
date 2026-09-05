import { useCallback, useEffect, useState } from "react";
import DriverOnboarding from "../../components/driver/DriverOnboarding";
import AvailabilityToggle from "../../components/driver/AvailabilityToggle";
import AcceptByIdCard from "../../components/driver/AcceptByIdCard";
import DriverActiveRidePanel from "../../components/driver/DriverActiveRidePanel";
import IncomingRideRequestModal from "../../components/driver/IncomingRideRequestModal";
import Loader from "../../components/Loader";
import ErrorState from "../../components/ErrorState";
import { useIncomingRideRequest } from "../../hooks/useIncomingRideRequest";
import * as driverApi from "../../services/driverApi";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";

const ACTIVE_STATUSES = ["accepted", "started"];

export default function DriverDashboard() {
  const [driver, setDriver] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { request, clear } = useIncomingRideRequest();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileRes = await driverApi.getMyDriverProfile();
      const driverData = profileRes.data.data.driver;
      setDriver(driverData);
      setNeedsOnboarding(false);

      if (driverData.status === "busy") {
        const ridesRes = await rideApi.getMyRides({ page: 1, limit: 5 });
        const current = ridesRes.data.data.rides.find((r) => ACTIVE_STATUSES.includes(r.status));
        setActiveRide(current || null);
      } else {
        setActiveRide(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setNeedsOnboarding(true);
      } else {
        setError(getErrorMessage(err, "We couldn't load your driver dashboard."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRideAccepted(ride) {
    clear();
    setDriver((prev) => (prev ? { ...prev, status: "busy" } : prev));
    setActiveRide(ride);
  }

  function handleRideChange(ride) {
    setActiveRide(ride);
    if (ride.status === "completed") {
      setDriver((prev) => (prev ? { ...prev, status: "available" } : prev));
      setTimeout(() => setActiveRide(null), 2500);
    }
  }

  if (loading) return <Loader fullScreen label="Loading your dashboard..." />;
  if (needsOnboarding) return <DriverOnboarding onComplete={() => load()} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!driver) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Driver Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model} · ${driver.vehicle.registrationNumber}` : "Your vehicle"}
        </p>
      </div>

      <AvailabilityToggle status={driver.status} onStatusChange={(status) => setDriver((prev) => ({ ...prev, status }))} />

      {activeRide ? (
        <DriverActiveRidePanel ride={activeRide} onRideChange={handleRideChange} />
      ) : driver.status === "available" ? (
        <AcceptByIdCard onAccepted={handleRideAccepted} />
      ) : null}

      <IncomingRideRequestModal request={request} onAccepted={handleRideAccepted} onDismiss={clear} />
    </div>
  );
}
