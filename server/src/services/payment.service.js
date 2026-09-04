const Payment = require("../models/Payment");
const Ride = require("../models/Ride");
const ApiError = require("../utils/ApiError");
const fareService = require("./fare.service");
const paymentProvider = require("./paymentProviders/simulatedPaymentProvider");
const kafkaProducer = require("./kafkaProducer");
const { KAFKA_TOPICS, PAYMENT_EVENT_TYPES, PAYMENT_CURRENCY } = require("../config/constants");

// Mirrors ride.service.js's VALID_TRANSITIONS/assertValidTransition pattern
// exactly — one map, one assertion function, reused everywhere a payment's
// status is about to change instead of duplicating the rule inline.
const VALID_TRANSITIONS = {
  pending: ["success", "failed"],
  success: [],
  failed: [],
};

function assertValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(400, `Cannot transition payment from '${currentStatus}' to '${nextStatus}'`);
  }
}

function populatePayment(paymentId) {
  return Payment.findById(paymentId).populate("rider", "-password");
}

// Fare calculated here (fare.service.js), from the ride's own persisted
// data only — never from the request body. Also persisted onto
// `ride.fare` (a field that already existed on Ride since Day 1, unused
// until now) purely as a convenient, informational snapshot; `payment.amount`
// remains the authoritative charge record regardless of what a re-run of
// the fare formula would produce later.
async function createPayment(rideId, riderUser) {
  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new ApiError(404, "Ride not found");
  }

  if (ride.rider.toString() !== riderUser._id.toString()) {
    throw new ApiError(403, "You are not authorized to pay for this ride");
  }

  if (ride.status !== "completed") {
    throw new ApiError(400, "Payment can only be created for a completed ride");
  }

  const { fare } = fareService.calculateFare(ride);

  let payment;
  let created;
  try {
    payment = await Payment.create({
      ride: ride._id,
      rider: riderUser._id,
      amount: fare,
      currency: PAYMENT_CURRENCY,
      status: "pending",
    });
    created = true;
  } catch (err) {
    // The unique index on `ride` is what actually prevents two concurrent
    // "create payment" requests from producing two Payment documents for
    // the same ride — whichever request loses the race lands here, not in
    // an if-exists-then-skip check beforehand (which would itself have the
    // exact same race condition Day 3's acceptRide fix was built to avoid).
    // The honest, idempotent response is the existing payment, not an error.
    if (err.code === 11000) {
      payment = await Payment.findOne({ ride: ride._id });
      created = false;
    } else {
      throw err;
    }
  }

  if (created) {
    if (ride.fare !== fare) {
      ride.fare = fare;
      await ride.save();
    }

    await kafkaProducer.publishEvent(KAFKA_TOPICS.paymentEvents, PAYMENT_EVENT_TYPES.created, {
      paymentId: payment._id.toString(),
      rideId: ride._id.toString(),
      riderId: riderUser._id.toString(),
      amount: payment.amount,
      currency: payment.currency,
    });
  }

  return { payment: await populatePayment(payment._id), created };
}

async function getPaymentById(paymentId, user) {
  const payment = await populatePayment(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  if (payment.rider._id.toString() !== user._id.toString()) {
    throw new ApiError(403, "You are not authorized to view this payment");
  }

  return payment;
}

// The core of Day 7's idempotency + concurrency story. Order of operations
// follows the brief exactly: validate request -> validate payment state ->
// (call the simulated provider) -> update MongoDB -> persist paidAt/failedAt
// -> publish payment.success/failed -> (a consumer, not this function,
// notifies Socket.IO — see paymentEventConsumer.js, matching Day 6's Kafka
// -> Socket.IO bridge pattern rather than duplicating that logic here).
async function simulatePayment(paymentId, riderUser, { idempotencyKey, requestedResult }) {
  if (!idempotencyKey) {
    throw new ApiError(400, "Idempotency-Key header is required");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  if (payment.rider.toString() !== riderUser._id.toString()) {
    throw new ApiError(403, "You are not authorized to pay for this ride");
  }

  // Idempotent replay: this exact key was already used to settle this
  // payment (whether by this exact request retried, or a concurrent
  // duplicate that got there first — see the race-handling below). Return
  // the already-settled result rather than erroring or re-processing —
  // this is what makes "the rider double-clicks PAY" or "the client
  // retries after a lost response" safe: one financial effect, however
  // many times the request arrives.
  if (payment.idempotencyKey === idempotencyKey) {
    return populatePayment(payment._id);
  }

  if (payment.status !== "pending") {
    throw new ApiError(409, `Payment is already ${payment.status} and cannot be processed again`);
  }

  assertValidTransition(payment.status, requestedResult === "failure" ? "failed" : "success");

  const providerResult = await paymentProvider.charge({
    amount: payment.amount,
    currency: payment.currency,
    requestedResult,
  });

  const updateFields = {
    status: providerResult.status,
    idempotencyKey,
    providerReference: providerResult.providerReference,
  };
  if (providerResult.status === "success") {
    updateFields.paidAt = new Date();
  } else {
    updateFields.failedAt = new Date();
    updateFields.failureReason = providerResult.failureReason;
  }

  // Atomic conditional update — the same race-safety pattern as Day 3's
  // acceptRide. Two concurrent PAY requests (double-click, or a client
  // retry racing the original) can both pass the checks above before
  // either writes; this filter re-checks `status: "pending"` atomically at
  // write time, so only the first one actually applies.
  const updated = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: updateFields },
    { new: true }
  );

  let settled = updated;
  if (!settled) {
    // Lost the race. If the winner used this same idempotency key (e.g. the
    // exact same request arrived twice and both reached this point before
    // either had written), this is still a legitimate idempotent replay —
    // return the winner's result. Otherwise, this really is a second,
    // different attempt to pay an already-settled payment, which is
    // correctly rejected.
    const latest = await Payment.findById(paymentId);
    if (latest.idempotencyKey === idempotencyKey) {
      return populatePayment(latest._id);
    }
    throw new ApiError(409, `Payment is already ${latest.status} and cannot be processed again`);
  }

  await kafkaProducer.publishEvent(
    KAFKA_TOPICS.paymentEvents,
    settled.status === "success" ? PAYMENT_EVENT_TYPES.success : PAYMENT_EVENT_TYPES.failed,
    {
      paymentId: settled._id.toString(),
      rideId: settled.ride.toString(),
      riderId: settled.rider.toString(),
      amount: settled.amount,
      currency: settled.currency,
    }
  );

  return populatePayment(settled._id);
}

module.exports = {
  createPayment,
  getPaymentById,
  simulatePayment,
  assertValidTransition,
  VALID_TRANSITIONS,
};
