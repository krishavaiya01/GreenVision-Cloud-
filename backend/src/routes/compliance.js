// src/routes/compliance.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import * as ComplianceController from '../controllers/ComplianceController.js';

const router = express.Router();

// Apply authentication to all compliance routes
router.use(protect());

// POST /api/compliance/audit-logs - Create audit log entry
router.post('/audit-logs', ComplianceController.createAuditLog);

// GET /api/compliance/audit-logs - Get audit logs
router.get('/audit-logs', ComplianceController.getAuditLogs);

// GET /api/compliance/audit-logs/verify/chain - Verify chain integrity
router.get('/audit-logs/verify/chain', ComplianceController.verifyChainIntegrity);

// GET /api/compliance/audit-logs/verify/:logId - Verify specific log integrity
router.get('/audit-logs/verify/:logId', ComplianceController.verifyLogIntegrity);

// GET /api/compliance/audit-logs/trail/:resourceType/:resourceId - Get resource audit trail
router.get('/audit-logs/trail/:resourceType/:resourceId', ComplianceController.getResourceAuditTrail);

// GET /api/compliance/audit-logs/export - Export audit logs as CSV
router.get('/audit-logs/export', ComplianceController.exportAuditLogs);

// GET /api/compliance/audit-logs/stats - Get audit statistics
router.get('/audit-logs/stats', ComplianceController.getAuditStatistics);

export default router;
