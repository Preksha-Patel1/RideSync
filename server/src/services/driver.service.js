const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const ApiError = require("../utils/ApiError");

async function createProfile(userId, { vehicleType, brand, model, registrationNumber }) {
  const existingDriver = await Driver.findOne({ user: userId });
  if (existingDriver) {
    throw new ApiError(409, "Driver profile already exists for this user");
  }

  const existingVehicle = await Vehicle.findOne({ registrationNumber: registrationNumber.toUpperCase() });
  if (existingVehicle) {
    throw new ApiError(409, "A vehicle with this registration number already exists");
  }

  const driver = await Driver.create({ user: userId, status: "offline" });

  const vehicle = await Vehicle.create({
    driver: driver._id,
    vehicleType,
    brand,
    model,
    registrationNumber,
  });

  driver.vehicle = vehicle._id;
  await driver.save();

  return getProfileByUserId(userId);
}

async function getProfileByUserId(userId) {
  const driver = await Driver.findOne({ user: userId })
    .populate("user", "-password")
    .populate("vehicle");

  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  return driver;
}

async function updateStatus(userId, status) {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  driver.status = status;
  await driver.save();

  return driver;
}

async function updateLocation(userId, coordinates) {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) {
    throw new ApiError(404, "Driver profile not found");
  }

  driver.currentLocation = { type: "Point", coordinates };
  await driver.save();

  return driver;
}

module.exports = { createProfile, getProfileByUserId, updateStatus, updateLocation };
