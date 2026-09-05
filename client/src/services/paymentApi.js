import api from "./api";

// Maps 1:1 to server/src/routes/payment.routes.js.

// POST /api/payments/:rideId is itself idempotent server-side (a repeat
// call returns the existing payment via a 200, not a duplicate) — see
// server/src/services/payment.service.js#createPayment — so no client-side
// key is needed here.
export function createPayment(rideId) {
  return api.post(`/payments/${rideId}`);
}

export function getPayment(paymentId) {
  return api.get(`/payments/${paymentId}`);
}

// The Idempotency-Key header is required by the backend (400 if missing —
// see payment.service.js#simulatePayment) specifically because this call
// can have a real financial effect: retrying with the SAME key is what
// makes a double-click or a network-retry safe (the backend returns the
// already-settled result instead of processing twice). Generate one key per
// logical "pay" attempt with generateIdempotencyKey() below, and reuse that
// exact key for any retry of that same attempt — never mint a fresh one on
// retry, or the safety guarantee is lost.
export function simulatePayment(paymentId, { result, idempotencyKey }) {
  return api.post(
    `/payments/${paymentId}/pay`,
    { result },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );
}

export function generateIdempotencyKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
