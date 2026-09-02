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

module.exports = router;
