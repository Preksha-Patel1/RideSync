import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import GuestRoute from "./components/GuestRoute";
import RiderLayout from "./layouts/RiderLayout";
import DriverLayout from "./layouts/DriverLayout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

import RiderDashboard from "./pages/rider/RiderDashboard";
import RiderRideDetails from "./pages/rider/RiderRideDetails";
import RiderHistory from "./pages/rider/RiderHistory";

import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverRideDetails from "./pages/driver/DriverRideDetails";
import DriverHistory from "./pages/driver/DriverHistory";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute role="rider" />}>
                <Route path="/rider" element={<RiderLayout />}>
                  <Route index element={<RiderDashboard />} />
                  <Route path="ride/:id" element={<RiderRideDetails />} />
                  <Route path="history" element={<RiderHistory />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Route>

              <Route element={<RoleRoute role="driver" />}>
                <Route path="/driver" element={<DriverLayout />}>
                  <Route index element={<DriverDashboard />} />
                  <Route path="ride/:id" element={<DriverRideDetails />} />
                  <Route path="history" element={<DriverHistory />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Route>
            </Route>

            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
