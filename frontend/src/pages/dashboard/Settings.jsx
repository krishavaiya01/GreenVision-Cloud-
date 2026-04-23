import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  Select,
  MenuItem,
  Button,
  TextField,
} from "@mui/material";
import DashboardLayout from "../../components/common/Layout/DashboardLayout";
import { useTheme } from "../../hooks/useTheme";
import axios from "axios";
import { authApi } from "../../services/api/authApi";
import { toast } from "react-hot-toast";
import { Link as RouterLink } from "react-router-dom";
import Link from "@mui/material/Link";

export default function Settings() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const token = localStorage.getItem("token"); // Access token saved on login

  // Load current user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!token) {
          toast.error("You must be logged in to view settings.");
          return;
        }
        const data = await authApi.getMe();
        const user = data.user;
        if (!user) {
          toast.error("User not found.");
          return;
        }
        setName(user.name || "");
        setEmail(user.email || "");
        setNotifications(user.preferences?.notifications ?? true);
        setLanguage(user.preferences?.language || "en");
      } catch (err) {
        console.error(err);
        toast.error("Failed to load settings.");
      }
    };
    if (token) fetchSettings();
  }, [token]);

  // Save updated settings
  const handleSave = async () => {
    if (!token) {
      toast.error("You must be logged in to update settings.");
      return;
    }
    setLoading(true);
    try {
      await authApi.updateSettings({
        name,
        email,
        preferences: { notifications, language },
      });
      toast.success("Settings updated successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update settings.");
    }
    setLoading(false);
  };

  // Update password
  const handlePasswordUpdate = async () => {
    if (!token) {
      toast.error("You must be logged in to update password.");
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("Please enter both current and new password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.updatePassword(currentPassword, newPassword);
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update password.");
    }
    setLoading(false);
  };

  // Delete account
  const handleDelete = async () => {
    if (!token) {
      toast.error("You must be logged in to delete account.");
      return;
    }
    setLoading(true);
    try {
      await authApi.deleteAccount();
      toast.success("Account deleted. Logging out...");
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete account.");
    }
    setLoading(false);
  };

  return (
    <DashboardLayout title="Settings">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Appearance */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Appearance
          </Typography>
          <FormControlLabel
            control={<Switch checked={isDarkMode} onChange={toggleTheme} />}
            label={isDarkMode ? "Dark Mode" : "Light Mode"}
          />
        </Paper>

        {/* Notifications */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Notifications
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            }
            label={notifications ? "Enabled" : "Disabled"}
          />
          <Box mt={1}>
            <Link component={RouterLink} to="/settings/notifications" underline="hover">
              Open detailed email report preferences →
            </Link>
          </Box>
        </Paper>

        {/* Language */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Language
          </Typography>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            sx={{ width: 200 }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="hi">हिन्दी</MenuItem>
            <MenuItem value="mr">मराठी</MenuItem>
            <MenuItem value="es">Español</MenuItem>
          </Select>
        </Paper>

        {/* Account Info */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Account Information
          </Typography>
          <TextField
            label="Name"
            fullWidth
            sx={{ mb: 2 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            sx={{ mb: 2 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </Paper>

        {/* Change Password */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Change Password
          </Typography>
          <Box
            display="flex"
            flexDirection="column"
            gap={2}
            maxWidth={400}
            mt={2}
          >
            <TextField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handlePasswordUpdate}
              disabled={loading}
            >
              Update Password
            </Button>
          </Box>
        </Paper>

        {/* Danger Zone */}
        <Paper sx={{ p: 3, border: "1px solid red" }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Danger Zone
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete Account"}
          </Button>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
