import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";

// Gate #1: must be authenticated at all. Gate #2 (RoleRoute) further
// restricts by role — kept as two separate components so a route can
// require "any authenticated user" without also requiring a specific role.
export default function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <Loader fullScreen label="Loading RideSync..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
