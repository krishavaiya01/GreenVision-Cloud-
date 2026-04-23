
import express from "express";
import { signup, login, refreshToken, updateSettings, updatePassword } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { getUsers } from "../controllers/authController.js";
import User from "../models/User.js"; 

const router = express.Router();

// PATCH /auth/password (update own password)
router.patch("/password", protect(), updatePassword);

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken); // For refreshing access token
router.get("/getusers", getUsers);

// PUT /auth/settings (update own settings)
router.put("/settings", protect(), updateSettings);

// DELETE /auth/delete (delete own account)
router.delete("/delete", protect(), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete account", error: err.message });
  }
});

// Example protected route (admin only)
router.get("/admin-data", protect(["admin"]), (_req, res) => {
  res.json({ message: "This is admin-only data." });
});

// Get user data (logged in users)
router.get("/me", protect(), async (req, res) => {
  // Assuming req.user from middleware
  res.json({ user: req.user });
});

export default router;