const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const rideService = require("../services/ride.service");

async function createRide(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation failed", errors.array().map((e) => ({ field: e.path, message: e.msg })));
    }

    const ride = await rideService.createRide(req.user._id, req.body);

    res.status(201).json({
      success: true,
      message: "Ride requested successfully",
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

async function getRide(req, res, next) {
  try {
    const ride = await rideService.getRideById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createRide, getRide };
