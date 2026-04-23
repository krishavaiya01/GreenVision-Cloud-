import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProviderWrapper, useThemeContext } from "./context/ThemeContext";
import ProtectedRoute from "./components/common/ProtectedRoute";

// Pages
import LandingPage from "./pages/landing/LandingPage";
import Auth from "./pages/auth/Auth.jsx"; // Single Auth file
import Dashboard from "./pages/dashboard/Dashboard";
import CloudMonitoring from "./pages/dashboard/CloudMonitoring";
import CarbonTracking from "./pages/dashboard/CarbonTracking";
import AIRecommendations from "./pages/dashboard/AIRecommendations";
import AIAssistant from "./pages/dashboard/AIAssistant.jsx";
import MultiCloud from "./pages/dashboard/MultiCloud";
import Analytics from "./pages/dashboard/Analytics";
import CarbonOffsets from "./pages/dashboard/CarbonOffsets";
import Kubernetes from "./pages/dashboard/Kubernetes";
import Settings from "./pages/dashboard/Settings";
import HelpSupport from "./pages/dashboard/HelpSupport";
import Notifications from "./pages/settings/Notifications.jsx";
import ComplianceDashboard from "./pages/compliance/ComplianceDashboard";

function AppContent() {
  const { mode, toggleTheme } = useThemeContext();

  return (
    <>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <Auth initialTab={0} /> {/* 0 = Login tab */}
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute requireAuth={false}>
                <Auth initialTab={1} /> {/* 1 = Register tab */}
              </ProtectedRoute>
            }
          />

          {/* Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/carbon-tracking"
            element={
              <ProtectedRoute>
                <CarbonTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/multi-cloud"
            element={
              <ProtectedRoute>
                <MultiCloud />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/carbon-offsets"
            element={
              <ProtectedRoute>
                <CarbonOffsets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/kubernetes"
            element={
              <ProtectedRoute>
                <Kubernetes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpSupport />
              </ProtectedRoute>
            }
          />

          {/* Standalone AI Recommendations */}
          <Route
            path="/ai-recommendations"
            element={
              <ProtectedRoute>
                <AIRecommendations />
              </ProtectedRoute>
            }
          />
          {/* AI Assistant */}
          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute>
                <AIAssistant />
              </ProtectedRoute>
            }
          />
          {/* Back-compat: old chatbot path */}
          <Route path="/dashboard/chatbot" element={<Navigate to="/ai-assistant" replace />} />
          {/* Standalone Cloud Monitoring */}
          <Route
            path="/cloud-monitoring/*"
            element={
              <ProtectedRoute>
                <CloudMonitoring />
              </ProtectedRoute>
            }
          />

          <Route
            path="/compliance"
            element={
              <ProtectedRoute>
                <ComplianceDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      {/* Global Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
            borderRadius: "12px",
            fontWeight: "500",
          },
          success: { style: { background: "#4CAF50" } },
          error: { style: { background: "#f44336" } },
        }}
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProviderWrapper>
        <AppContent />
      </ThemeProviderWrapper>
    </AuthProvider>
  );
}

export default App;
