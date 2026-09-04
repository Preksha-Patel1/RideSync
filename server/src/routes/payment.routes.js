const express = require("express");
const { body } = require("express-validator");
const paymentController = require("../controllers/payment.controller");
const authenticate = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

// Only a rider can initiate or simulate payment for their own ride —
// ownership is still re-checked inside payment.service.js from req.user,
// never trusted from a route param alone (same principle as ride.routes.js).
router.post("/:rideId", requireRole("rider"), paymentController.createPayment);

router.get("/:paymentId", paymentController.getPayment);

router.post(
  "/:paymentId/pay",
  requireRole("rider"),
  [body("result").optional().isIn(["success", "failure"]).withMessage("result must be 'success' or 'failure'")],
  paymentController.simulatePayment
);

module.exports = router;
