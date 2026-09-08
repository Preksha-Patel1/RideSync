const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    status: {
      type: String,
      enum: ["offline", "available", "busy"],
      default: "offline",
    },
    currentLocation: {
      type: pointSchema,
      default: () => ({ type: "Point", coordinates: [0, 0] }),
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 4.5,
    },
    // Set only by scripts/seedDrivers.js. Lets matching-time code (see
    // ride.service.js#createRide) distinguish a demo/bot driver — safe to
    // auto-accept on behalf of — from a real driver, who should always get
    // the normal manual accept/reject flow even if they happen to be the
    // nearest match.
    isSimulated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

driverSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Driver", driverSchema);
