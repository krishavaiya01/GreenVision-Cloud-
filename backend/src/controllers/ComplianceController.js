// src/controllers/ComplianceController.js
import auditLogService from '../services/audit-log-service.js';

export const createAuditLog = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { action, resourceType, resourceId, details, status, errorMessage } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'action is required'
      });
    }

    const log = await auditLogService.createAuditLog({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      status,
      errorMessage
    });

    res.json({
      success: true,
      data: log,
      message: 'Audit log created'
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: error.message
    });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { action, resourceType, resourceId, status, startDate, endDate, limit } = req.query;

    const logs = await auditLogService.getAuditLogs(userId, {
      action,
      resourceType,
      resourceId,
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 100
    });

    res.json({
      success: true,
      data: {
        logs,
        totalLogs: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
};

export const verifyChainIntegrity = async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await auditLogService.verifyChainIntegrity(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error verifying chain integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify chain integrity',
      error: error.message
    });
  }
};

export const verifyLogIntegrity = async (req, res) => {
  try {
    const { logId } = req.params;

    const result = await auditLogService.verifyLogIntegrity(logId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error verifying log integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify log integrity',
      error: error.message
    });
  }
};

export const getResourceAuditTrail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { resourceType, resourceId } = req.params;

    const trail = await auditLogService.getResourceAuditTrail(userId, resourceType, resourceId);

    res.json({
      success: true,
      data: {
        trail,
        totalEntries: trail.length
      }
    });
  } catch (error) {
    console.error('Error fetching resource audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource audit trail',
      error: error.message
    });
  }
};

export const exportAuditLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { action, resourceType, status, startDate, endDate } = req.query;

    const csv = await auditLogService.exportAuditLogsAsCSV(userId, {
      action,
      resourceType,
      status,
      startDate,
      endDate
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
      error: error.message
    });
  }
};

export const getAuditStatistics = async (req, res) => {
  try {
    const userId = req.user?.id;

    const stats = await auditLogService.getAuditStatistics(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics',
      error: error.message
    });
  }
};

export default {
  createAuditLog,
  getAuditLogs,
  verifyChainIntegrity,
  verifyLogIntegrity,
  getResourceAuditTrail,
  exportAuditLogs,
  getAuditStatistics
};
