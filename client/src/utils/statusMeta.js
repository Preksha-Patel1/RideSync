// Central mapping of every backend enum this app displays to a label + Tailwind
// classes, so a status badge always looks the same everywhere it appears
// instead of every screen picking its own colors. Values here must match
// server/src/models/Ride.js, Payment.js, and Driver.js exactly.

export const RIDE_STEPS = ["requested", "accepted", "started", "completed"];

export const RIDE_STATUS_META = {
  requested: { label: "Finding a driver", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Driver on the way", badge: "bg-brand-50 text-brand-700 border-brand-200" },
  started: { label: "In progress", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const PAYMENT_STATUS_META = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  success: { label: "Paid", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const DRIVER_STATUS_META = {
  offline: { label: "Offline", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  available: { label: "Online", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  busy: { label: "On a ride", badge: "bg-brand-50 text-brand-700 border-brand-200" },
};

export function rideStatusMeta(status) {
  return RIDE_STATUS_META[status] || { label: status, badge: "bg-slate-100 text-slate-600 border-slate-200" };
}

export function paymentStatusMeta(status) {
  return PAYMENT_STATUS_META[status] || { label: status, badge: "bg-slate-100 text-slate-600 border-slate-200" };
}

export function driverStatusMeta(status) {
  return DRIVER_STATUS_META[status] || { label: status, badge: "bg-slate-100 text-slate-600 border-slate-200" };
}
