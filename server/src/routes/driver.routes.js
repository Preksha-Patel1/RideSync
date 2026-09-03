const express = require("express");
const { body } = require("express-validator");
const driverController = require("../controllers/driver.controller");
const authenticate = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate, requireRole("driver"));

router.get("/me", driverController.getMyProfile);

router.post(
  "/profile",
  [
    body("vehicleType").isIn(["bike", "auto", "car"]).withMessage("Vehicle type must be bike, auto, or car"),
    body("brand").trim().notEmpty().withMessage("Brand is required"),
    body("model").trim().notEmpty().withMessage("Model is required"),
    body("registrationNumber").trim().notEmpty().withMessage("Registration number is required"),
  ],
  driverController.createProfile
);

router.patch(
  "/status",
  [body("status").isIn(["offline", "available", "busy"]).withMessage("Status must be offline, available, or busy")],
  driverController.updateStatus
);

router.patch(
  "/location",
  [
    body("coordinates")
      .isArray({ min: 2, max: 2 })
      .withMessage("coordinates must be an array of [longitude, latitude]"),
    body("coordinates.0").isFloat({ min: -180, max: 180 }).withMessage("longitude must be between -180 and 180"),
    body("coordinates.1").isFloat({ min: -90, max: 90 }).withMessage("latitude must be between -90 and 90"),
  ],
  driverController.updateLocation
);

module.exports = router;
