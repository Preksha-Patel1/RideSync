import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// A rider hitting /driver/* (or vice versa) is redirected to their own
// dashboard rather than shown a 403 page — role is fixed at registration
// (server/src/models/User.js) so there's never a legitimate reason for a
// user to need access to the other role's routes.
export default function RoleRoute({ role }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <Navigate to={`/${user?.role}`} replace />;
  }

  return <Outlet />;
}
