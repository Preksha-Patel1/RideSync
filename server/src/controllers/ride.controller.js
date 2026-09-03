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

async function getMyRides(req, res, next) {
  try {
    const { rides, pagination } = await rideService.getMyRides(req.user, req.query);

    res.status(200).json({
      success: true,
      data: { rides, pagination },
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

async function acceptRide(req, res, next) {
  try {
    const ride = await rideService.acceptRide(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Ride accepted successfully",
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

async function startRide(req, res, next) {
  try {
    const ride = await rideService.startRide(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Ride started successfully",
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

async function completeRide(req, res, next) {
  try {
    const ride = await rideService.completeRide(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Ride completed successfully",
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

async function cancelRide(req, res, next) {
  try {
    const ride = await rideService.cancelRide(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Ride cancelled successfully",
      data: { ride },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createRide, getMyRides, getRide, acceptRide, startRide, completeRide, cancelRide };
