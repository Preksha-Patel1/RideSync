const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const driverRoutes = require("./routes/driver.routes");
const rideRoutes = require("./routes/ride.routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Ride-hailing backend is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/rides", rideRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
