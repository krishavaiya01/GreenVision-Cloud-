// src/components/common/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, requireAuth = true }) {
  const { user } = useAuth();

  // Public route but user already logged in -> redirect to dashboard
  if (!requireAuth && user?.id) {
    return <Navigate to="/dashboard" replace />;
  }

  // Protected route but user not logged in -> redirect to login
  if (requireAuth && !user?.id) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
