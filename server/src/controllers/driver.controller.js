const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const driverService = require("../services/driver.service");

async function createProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation failed", errors.array().map((e) => ({ field: e.path, message: e.msg })));
    }

    const driver = await driverService.createProfile(req.user._id, req.body);

    res.status(201).json({
      success: true,
      message: "Driver profile created successfully",
      data: { driver },
    });
  } catch (err) {
    next(err);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const driver = await driverService.getProfileByUserId(req.user._id);

    res.status(200).json({
      success: true,
      data: { driver },
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation failed", errors.array().map((e) => ({ field: e.path, message: e.msg })));
    }

    const driver = await driverService.updateStatus(req.user._id, req.body.status);

    res.status(200).json({
      success: true,
      message: "Driver status updated successfully",
      data: { driver },
    });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation failed", errors.array().map((e) => ({ field: e.path, message: e.msg })));
    }

    const driver = await driverService.updateLocation(req.user._id, req.body.coordinates);

    res.status(200).json({
      success: true,
      message: "Driver location updated successfully",
      data: { driver },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createProfile, getMyProfile, updateStatus, updateLocation };
