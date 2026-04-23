// src/services/audit-log-service.js
import crypto from 'crypto';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

class AuditLogService {
  /**
   * Generate SHA-256 hash from data
   * @private
   */
  _hashData(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Create audit log entry with hash chain
   * @param {Object} options - Log entry options
   * @param {string} options.userId - User ID
   * @param {string} options.action - Action type
   * @param {string} options.resourceType - Resource type
   * @param {string} options.resourceId - Resource ID (optional)
   * @param {Object} options.details - Action details
   * @param {string} options.ipAddress - Client IP
   * @param {string} options.userAgent - User agent
   * @param {string} options.status - success/failure/partial
   * @param {string} options.errorMessage - Error message if failed
   * @returns {Promise<Object>} Created audit log
   */
  async createAuditLog(options = {}) {
    try {
      const {
        userId,
        action,
        resourceType = 'system',
        resourceId = null,
        details = {},
        ipAddress = null,
        userAgent = null,
        status = 'success',
        errorMessage = null
      } = options;

      if (!userId || !action) {
        throw new Error('userId and action are required');
      }

      const timestamp = new Date();

      // Get the latest log to chain from
      const latestLog = await AuditLog.getLatestLog(userId);  // userId is now a String
      const previousHash = latestLog ? latestLog.hash : null;

      // Prepare data for hashing
      const dataToHash = {
        userId,  // Keep as String
        action,
        resourceType,
        resourceId,
        timestamp: timestamp.toISOString(),
        previousHash,
        details
      };

      // Generate hash for this log entry
      const hash = this._hashData(dataToHash);

      // Create the audit log
      const auditLog = await AuditLog.create({
        userId,  // Use userId directly as String
        action,
        resourceType,
        resourceId,
        details,
        hash,
        previousHash,
        timestamp,
        ipAddress,
        userAgent,
        status,
        errorMessage,
        chainVerified: true
      });

      console.log(`✅ Audit log created: ${action} for resource ${resourceType}:${resourceId || 'N/A'}`);
      return auditLog.toObject();
    } catch (error) {
      console.error('Audit log creation error:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a user with optional filters
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Audit logs
   */
  async getAuditLogs(userId, filters = {}) {
    try {
      const query = { userId };  // userId is now a String, no conversion needed

      if (filters.action) query.action = filters.action;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.resourceId) query.resourceId = filters.resourceId;
      if (filters.status) query.status = filters.status;

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(filters.limit || 100)
        .lean();

      return logs;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Verify chain integrity for a user's audit trail
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyChainIntegrity(userId) {
    try {
      const result = await AuditLog.verifyChainIntegrity(userId);  // userId is now a String
      return result;
    } catch (error) {
      console.error('Chain verification error:', error);
      throw error;
    }
  }

  /**
   * Check if a specific log entry has been tampered with
   * @param {string} logId - Log entry ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyLogIntegrity(logId) {
    try {
      const log = await AuditLog.findById(logId).lean();

      if (!log) {
        return { valid: false, message: 'Log entry not found' };
      }

      // Reconstruct the hash to verify
      const dataToHash = {
        userId: log.userId.toString(),
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        timestamp: log.timestamp.toISOString(),
        previousHash: log.previousHash,
        details: log.details
      };

      const calculatedHash = this._hashData(dataToHash);

      if (calculatedHash !== log.hash) {
        return {
          valid: false,
          message: 'Hash mismatch - log entry may have been tampered with',
          expectedHash: calculatedHash,
          storedHash: log.hash
        };
      }

      return { valid: true, message: 'Log entry integrity verified' };
    } catch (error) {
      console.error('Log integrity verification error:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific resource
   * @param {string} userId - User ID
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @returns {Promise<Array>} Audit logs for resource
   */
  async getResourceAuditTrail(userId, resourceType, resourceId) {
    try {
      return await this.getAuditLogs(userId, {
        resourceType,
        resourceId
      });
    } catch (error) {
      console.error('Error fetching resource audit trail:', error);
      throw error;
    }
  }

  /**
   * Export audit logs as CSV format
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<string>} CSV formatted string
   */
  async exportAuditLogsAsCSV(userId, filters = {}) {
    try {
      const logs = await this.getAuditLogs(userId, { ...filters, limit: 10000 });

      // CSV header
      let csv = 'Timestamp,Action,ResourceType,ResourceId,Status,Hash,PreviousHash,Details\n';

      // CSV rows
      logs.forEach(log => {
        const detailsStr = log.details ? JSON.stringify(log.details) : '{}';
        const row = [
          log.timestamp.toISOString(),
          log.action,
          log.resourceType,
          log.resourceId || '',
          log.status,
          log.hash,
          log.previousHash || '',
          `"${detailsStr.replace(/"/g, '""')}"` // Escape quotes in JSON
        ].join(',');
        csv += row + '\n';
      });

      return csv;
    } catch (error) {
      console.error('CSV export error:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getAuditStatistics(userId) {
    try {
      const stats = await AuditLog.aggregate([
        { $match: { userId: userId } },  // userId is now a String, not ObjectId
        {
          $group: {
            _id: null,
            totalLogs: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
            uniqueActions: { $addToSet: '$action' },
            uniqueResources: { $addToSet: '$resourceType' }
          }
        }
      ]);

      return stats[0] || {
        totalLogs: 0,
        successCount: 0,
        failureCount: 0,
        uniqueActions: [],
        uniqueResources: []
      };
    } catch (error) {
      console.error('Statistics error:', error);
      throw error;
    }
  }
}

export default new AuditLogService();
