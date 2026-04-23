// src/pages/Auth/Auth.jsx
import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
  CircularProgress
} from "@mui/material";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../styles/theme/colors";
import logo from "../../assets/logo.png";
import { motion } from "framer-motion";
import ImmersiveCloudBackground from "../../components/ImmersiveCloudBackground";

export default function Auth({ initialTab = 0 }) {
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleTabChange = (e, newValue) => {
    setTab(newValue);
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab === 1 && form.password !== form.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    setLoading(true);
    try {
      if (tab === 0) {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5050/api'}/auth/login`,
          { email: form.email, password: form.password },
          { withCredentials: true }
        );
        toast.success(data.message || "Login successful");
        if (data.accessToken) localStorage.setItem("token", data.accessToken);
        if (data.user && (data.user.id || data.user._id)) {
          localStorage.setItem("userId", data.user.id || data.user._id);
        }
        loginUser(data.user);
      } else {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5050/api'}/auth/signup`,
          { name: form.name, email: form.email, password: form.password },
          { withCredentials: true }
        );
        toast.success(data.message || "Account created");
        if (data.accessToken) localStorage.setItem("token", data.accessToken);
        if (data.user && (data.user._id)) {
          localStorage.setItem("userId", data.user._id);
        }
        loginUser(data.user);
      }
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      {/* ✅ Reuse immersive clouds */}
      <ImmersiveCloudBackground />

      {/* Glassmorphism Auth Card */}
      <Container maxWidth="xs" sx={{ position: "relative", zIndex: 2 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              textAlign: "center",
              background: "rgba(255, 255, 255, 0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 8px 32px rgba(31,38,135,0.1)",
            }}
          >
            {/* Logo */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <img src={logo} alt="GreenVision Logo" style={{ height: 120, width: "auto" }} />
            </Box>

            {/* Tabs */}
            <Tabs
              value={tab}
              onChange={handleTabChange}
              centered
              sx={{
                mb: 3,
                "& .MuiTabs-indicator": { backgroundColor: colors.primary[900] },
                "& .MuiTab-root": { fontWeight: 600, fontFamily: "'Montserrat', sans-serif", color: colors.primary[700] },
                "& .Mui-selected": { color: colors.primary[900] },
              }}
            >
              <Tab label="Login" />
              <Tab label="Register" />
            </Tabs>

            {/* Heading */}
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ fontFamily: "'Montserrat', sans-serif", color: colors.primary[900] }}>
              {tab === 0 ? "Welcome Back 👋" : "Create Account ✨"}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.primary[700], mb: 3, fontFamily: "'Open Sans', sans-serif" }}>
              {tab === 0 ? "Login to continue your journey" : "Sign up to get started"}
            </Typography>

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit}>
              {tab === 1 && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Full Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  InputProps={{ sx: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 } }}
                />
              )}
              <TextField
                fullWidth
                margin="normal"
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                InputProps={{ sx: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                InputProps={{ sx: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 } }}
              />
              {tab === 1 && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  InputProps={{ sx: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 } }}
                />
              )}

              {/* Cloud credential fields removed intentionally for security: server handles AWS metrics centrally */}

              <Button
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  borderRadius: 2,
                  py: 1.2,
                  fontWeight: 600,
                  background: colors.primary[900],
                  "&:hover": { background: colors.primary[800] },
                  fontFamily: "'Montserrat', sans-serif"
                }}
                type="submit"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : tab === 0 ? "Login" : "Register"}
              </Button>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
