// src/routes/dashboard.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { exportDashboardReport } from '../controllers/ReportController.js';

const router = express.Router();

// Protect all dashboard routes
router.use(protect());

// Export report as PDF or CSV
router.post('/export', exportDashboardReport);

export default router;
