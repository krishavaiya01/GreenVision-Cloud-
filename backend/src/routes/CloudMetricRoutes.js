// src/routes/CloudMetricRoutes.js
import express from "express";
import {
  createCloudMetric,
  getCloudMetrics,
  getCloudMetricById,
  updateCloudMetric,
  deleteCloudMetric,
  getMetricsSummary,
  getCostSeries,
} from "../controllers/CloudMetricController.js";
import { protect, adminOnly, userOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect());

// POST /api/cloudmetrics - Create new cloud metric
router.post("/", createCloudMetric);

// GET /api/cloudmetrics - Get all cloud metrics for authenticated user
router.get("/", getCloudMetrics);

// GET /api/cloudmetrics/cost-series - Get per-provider cost series with anomalies
router.get("/cost-series", getCostSeries);

// GET /api/cloudmetrics/summary - Get metrics summary for authenticated user
router.get("/summary", getMetricsSummary);

// GET /api/cloudmetrics/:id - Get specific cloud metric by ID
router.get("/:id", getCloudMetricById);

// PUT /api/cloudmetrics/:id - Update cloud metric by ID
router.put("/:id", updateCloudMetric);

// DELETE /api/cloudmetrics/:id - Delete cloud metric by ID
router.delete("/:id", deleteCloudMetric);

// Admin-only routes (if needed)
router.get("/admin/all", adminOnly, async (req, res) => {
  try {
    // Get all metrics from all users (admin only)
    const CloudMetrics = (await import('../models/CloudMetrics.js')).default;
    const allMetrics = await CloudMetrics.find({})
      .populate('userId', 'name email')
      .sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: allMetrics,
      count: allMetrics.length,
      message: 'All cloud metrics retrieved (admin access)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all metrics',
      message: error.message
    });
  }
});

export default router;
