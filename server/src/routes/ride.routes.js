const express = require("express");
const { body } = require("express-validator");
const rideController = require("../controllers/ride.controller");
const authenticate = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

const locationValidators = (field) => [
  body(`${field}.address`).trim().notEmpty().withMessage(`${field} address is required`),
  body(`${field}.location.coordinates`)
    .isArray({ min: 2, max: 2 })
    .withMessage(`${field} coordinates must be an array of [longitude, latitude]`),
  body(`${field}.location.coordinates.0`)
    .isFloat({ min: -180, max: 180 })
    .withMessage(`${field} longitude must be between -180 and 180`),
  body(`${field}.location.coordinates.1`)
    .isFloat({ min: -90, max: 90 })
    .withMessage(`${field} latitude must be between -90 and 90`),
];

router.post(
  "/",
  requireRole("rider"),
  [...locationValidators("pickup"), ...locationValidators("destination")],
  rideController.createRide
);

router.get("/:id", rideController.getRide);

router.patch("/:id/accept", requireRole("driver"), rideController.acceptRide);
router.patch("/:id/start", requireRole("driver"), rideController.startRide);
router.patch("/:id/complete", requireRole("driver"), rideController.completeRide);
router.patch("/:id/cancel", requireRole("rider", "driver"), rideController.cancelRide);

module.exports = router;
