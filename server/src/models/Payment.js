const mongoose = require("mongoose");

// Payment is deliberately its own model, not fields bolted onto Ride —
// ride lifecycle and payment lifecycle are separate state machines with
// separate concerns (see ride.service.js's VALID_TRANSITIONS vs this
// model's own PENDING/SUCCESS/FAILED states in payment.service.js). A
// completed ride with a still-pending (or even failed) payment is a
// perfectly valid, expected state — one does not roll back the other.
const paymentSchema = new mongoose.Schema(
  {
    // One payment per ride for this learning implementation (see the
    // unique index below) — not "one active payment," literally one,
    // permanently. Retrying a failed payment by creating a second Payment
    // document for the same ride is intentionally not supported; see
    // README "Known limitations" for why and what a real system would add.
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Backend-calculated at creation time (fare.service.js) from the ride's
    // own pickup/destination/startedAt/completedAt — never accepted from
    // the client. Immutable once the payment exists: this is the amount
    // that was actually charged, independent of whatever the fare formula
    // might compute if run again later.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    // Always "simulated" until a real provider (e.g. Razorpay) is
    // integrated — see services/paymentProviders/.
    paymentMethod: {
      type: String,
      default: "simulated",
    },
    // Set on the request that actually transitions this payment out of
    // "pending" (see payment.service.js#simulatePayment). A later request
    // carrying this same key is recognized as a retry of the same attempt,
    // not a new one — the core of Day 7's idempotency mechanism.
    idempotencyKey: {
      type: String,
      default: null,
    },
    // A mock "transaction id" from the simulated provider, analogous to
    // what a real gateway would return — present on both success and
    // failure, since real providers issue a reference either way.
    providerReference: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Enforces "at most one payment per ride" atomically at the database level
// — this is what makes concurrent duplicate-create requests safe (see
// payment.service.js#createPayment): the loser of the race gets a MongoDB
// duplicate-key error instead of a second Payment document ever existing.
paymentSchema.index({ ride: 1 }, { unique: true });

module.exports = mongoose.model("Payment", paymentSchema);
