// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { getToken, getUser, isTokenExpired, clearAuth } from "../utils/auth";

/**
 * Backend roles: admin | dosen | mahasiswa
 * allowedRoles: array of backend role strings that can access the route
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = getToken();

  // If no token or token is expired, clear session and redirect to login
  if (!token || isTokenExpired()) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  // If allowedRoles specified, check role
  if (allowedRoles && allowedRoles.length > 0) {
    const user = getUser();
    const role = user?.role; // "admin" | "dosen" | "mahasiswa"

    if (!allowedRoles.includes(role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
