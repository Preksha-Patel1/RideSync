import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, History } from "lucide-react";
import BookingPanel from "../../components/rider/BookingPanel";
import ActiveRidePanel from "../../components/rider/ActiveRidePanel";
import RideCard from "../../components/RideCard";
import Loader from "../../components/Loader";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import * as rideApi from "../../services/rideApi";
import { getErrorMessage } from "../../services/api";

const ACTIVE_STATUSES = ["requested", "accepted", "started"];

export default function RiderDashboard() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rideApi.getMyRides({ page: 1, limit: 5 });
      const fetchedRides = res.data.data.rides;
      setRides(fetchedRides);
      setActiveRide(fetchedRides.find((r) => ACTIVE_STATUSES.includes(r.status)) || null);
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't load your rides."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  if (loading) return <Loader fullScreen label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadRides} />;

  const recentRides = rides.filter((r) => r._id !== activeRide?._id).slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {activeRide ? "Your ride" : `Where to, ${user.name.split(" ")[0]}?`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {activeRide ? "Here's what's happening with your current ride." : "Book a ride in just a few taps."}
        </p>
      </div>

      {activeRide ? (
        <ActiveRidePanel
          ride={activeRide}
          onRideChange={(updater) => setActiveRide((prev) => (prev ? updater(prev) : prev))}
          onCancelled={() => setActiveRide(null)}
        />
      ) : (
        <BookingPanel onRideCreated={setActiveRide} />
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Recent rides</h2>
          <Link to="/rider/history" className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentRides.length === 0 ? (
          <EmptyState icon={History} title="No rides yet" description="Your ride history will show up here once you take your first trip." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentRides.map((ride) => (
              <RideCard key={ride._id} ride={ride} role="rider" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
