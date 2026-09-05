import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Keeps an already-logged-in user from landing back on /login or /register
// — sends them straight to their own dashboard instead.
export default function GuestRoute() {
  const { isAuthenticated, user, initializing } = useAuth();

  if (initializing) return null;
  if (isAuthenticated) return <Navigate to={`/${user.role}`} replace />;

  return <Outlet />;
}
