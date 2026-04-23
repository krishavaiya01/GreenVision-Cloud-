import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@context/AuthContext";
import Loader from "@components/common/Loader";

const ProtectedRoute = ({ children, requireAuth = true }) => {
  const { user, isLoading } = useAuth();

  // Show loader while checking auth
  if (isLoading) return <Loader />;

  // If route requires auth but user is not logged in → redirect to /login
  if (requireAuth && !user) return <Navigate to="/login" replace />;

  // If route is public but user is logged in → redirect to /dashboard
  if (!requireAuth && user) return <Navigate to="/dashboard" replace />;

  // Otherwise, render the children
  return children;
};

export default ProtectedRoute;
