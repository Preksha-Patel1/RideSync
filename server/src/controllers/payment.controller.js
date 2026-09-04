const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const paymentService = require("../services/payment.service");

async function createPayment(req, res, next) {
  try {
    const { payment, created } = await paymentService.createPayment(req.params.rideId, req.user);

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Payment created successfully" : "Payment already exists for this ride",
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
}

async function getPayment(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.paymentId, req.user);

    res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
}

// This endpoint simulates the external payment-provider response — see
// services/paymentProviders/simulatedPaymentProvider.js for why `result` in
// the request body is a test-mode outcome selector, not the client
// dictating financial truth. The Idempotency-Key header is required (see
// payment.service.js#simulatePayment) so a double-click or client retry
// never produces a second financial effect.
async function simulatePayment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation failed", errors.array().map((e) => ({ field: e.path, message: e.msg })));
    }

    const idempotencyKey = req.headers["idempotency-key"];
    const payment = await paymentService.simulatePayment(req.params.paymentId, req.user, {
      idempotencyKey,
      requestedResult: req.body.result,
    });

    res.status(200).json({
      success: true,
      message: `Payment ${payment.status}`,
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPayment, getPayment, simulatePayment };
