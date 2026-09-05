import { useEffect, useState } from "react";
import { Mail, Phone, Shield, Car, Calendar } from "lucide-react";
import Loader from "../components/Loader";
import Badge from "../components/Badge";
import { useAuth } from "../context/AuthContext";
import { initials, formatShortDate } from "../utils/format";
import { driverStatusMeta } from "../utils/statusMeta";
import * as driverApi from "../services/driverApi";

// Read-only by design: the Day 1-7 backend has no "update profile" endpoint
// for either User or Driver, so this deliberately does not offer editing
// that would only ever update local state — see README "Known Limitations".
export default function Profile() {
  const { user } = useAuth();
  const [driver, setDriver] = useState(null);
  const [driverLoading, setDriverLoading] = useState(user.role === "driver");

  useEffect(() => {
    if (user.role !== "driver") return;
    driverApi
      .getMyDriverProfile()
      .then((res) => setDriver(res.data.data.driver))
      .catch(() => setDriver(null))
      .finally(() => setDriverLoading(false));
  }, [user.role]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your RideSync account information.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">
            {initials(user.name)}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user.name}</h2>
            <Badge label={user.role === "driver" ? "Driver" : "Rider"} className="mt-1 border-brand-200 bg-brand-50 text-brand-700" />
          </div>
        </div>

        <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
          <div className="flex items-center gap-3 py-3.5">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-sm text-slate-400">Email</dt>
            <dd className="truncate text-sm font-medium text-slate-800">{user.email}</dd>
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-sm text-slate-400">Phone</dt>
            <dd className="text-sm font-medium text-slate-800">{user.phone}</dd>
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <Shield className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-sm text-slate-400">Role</dt>
            <dd className="text-sm font-medium capitalize text-slate-800">{user.role}</dd>
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-sm text-slate-400">Joined</dt>
            <dd className="text-sm font-medium text-slate-800">{formatShortDate(user.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {user.role === "driver" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <Car className="h-4 w-4 text-slate-400" /> Vehicle
          </h2>

          {driverLoading ? (
            <Loader label="Loading vehicle details..." />
          ) : driver ? (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                {driver.vehicle?.brand} {driver.vehicle?.model}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {driver.vehicle?.vehicleType} &middot; {driver.vehicle?.registrationNumber}
              </p>
              <Badge label={driverStatusMeta(driver.status).label} className={`${driverStatusMeta(driver.status).badge} mt-2`} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">You haven&apos;t set up a driver profile yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
