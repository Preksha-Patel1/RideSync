import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import RideCard from "./RideCard";
import Loader from "./Loader";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import Button from "./Button";
import * as rideApi from "../services/rideApi";
import { getErrorMessage } from "../services/api";

const PAGE_SIZE = 8;

// Shared by both /rider/history and /driver/history — the backend endpoint
// (GET /api/rides/my-rides) already scopes results by the authenticated
// user's role server-side (server/src/services/ride.service.js#getMyRides),
// so this component only needs to know which counterpart field to display
// per row (handled by RideCard's own `role` prop).
export default function RideHistoryList({ role }) {
  const [rides, setRides] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((page) => {
    setLoading(true);
    setError(null);
    rideApi
      .getMyRides({ page, limit: PAGE_SIZE })
      .then((res) => {
        setRides(res.data.data.rides);
        setPagination(res.data.data.pagination);
      })
      .catch((err) => setError(getErrorMessage(err, "We couldn't load your ride history.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  if (loading) return <Loader fullScreen label="Loading ride history..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(pagination.page)} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Ride History</h1>
        <p className="mt-1 text-sm text-slate-500">All your past and ongoing rides.</p>
      </div>

      {rides.length === 0 ? (
        <EmptyState icon={History} title="No rides yet" description="Once you take a ride, it will show up here." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rides.map((ride) => (
              <RideCard key={ride._id} ride={ride} role={role} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => load(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm font-medium text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => load(pagination.page + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
