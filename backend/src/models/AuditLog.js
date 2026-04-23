// src/models/AuditLog.js
import mongoose from 'mongoose';
import crypto from 'crypto';

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: String,  // Changed to String for flexibility (can store ObjectId strings or regular user IDs)
    required: true,
    index: true
  },

  // Action details
  action: {
    type: String,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'ADMIN_ACCESS', 'SETTINGS_CHANGE'],
    required: true,
    index: true
  },

  // Resource information
  resourceType: {
    type: String,
    // Flexible enum - allows common types but not strictly limited
    enum: ['user', 'User', 'metrics', 'recommendation', 'anomaly', 'report', 'settings', 'credentials', 'system', 'file', 'document', 'auth', 'cloudmetrics', 'CloudMetrics'],
    default: 'system',
    index: true
  },

  resourceId: {
    type: String,
    default: null
  },

  // Detailed change information
  details: {
    type: Object,
    default: {}
  },

  // Hash chain for tamper-proofing
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  previousHash: {
    type: String,
    default: null,
    index: true
  },

  // Immutable timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },

  // Metadata
  ipAddress: {
    type: String,
    default: null
  },

  userAgent: {
    type: String,
    default: null
  },

  status: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    default: 'success'
  },

  errorMessage: {
    type: String,
    default: null
  },

  // Chain integrity flag
  chainVerified: {
    type: Boolean,
    default: true,
    index: true
  }

}, {
  timestamps: false, // We use immutable timestamp field instead
  versionKey: false
});

// Index for retrieving audit trail
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ chainVerified: 1, timestamp: -1 });

// Static method to get the latest log for hash chain continuation
AuditLogSchema.statics.getLatestLog = async function(userId) {
  return this.findOne({ userId }).sort({ timestamp: -1 }).lean();
};

// Static method to verify chain integrity
AuditLogSchema.statics.verifyChainIntegrity = async function(userId) {
  const logs = await this.find({ userId }).sort({ timestamp: 1 }).lean();
  
  // Helper to recalculate hash (must match the service hash logic)
  const calculateHash = (log) => {
    const hash = crypto.createHash('sha256');
    // Order MUST match the service's dataToHash: userId, action, resourceType, resourceId, timestamp, previousHash, details
    // The service defaults details to {} when undefined, so we must do the same
    const data = {
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
      previousHash: log.previousHash,
      details: log.details || {}  // Default to {} to match service behavior
    };
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  };
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Verify log's own hash hasn't been tampered
    const recalculatedHash = calculateHash(log);
    if (log.hash !== recalculatedHash) {
      return { valid: false, errorAt: i, message: 'Log hash does not match content (tampered)' };
    }
    
    if (i === 0) {
      // First log should have no previous hash
      if (log.previousHash !== null) {
        return { valid: false, errorAt: i, message: 'First log should have no previous hash' };
      }
    } else {
      // Verify hash chain
      const prevLog = logs[i - 1];
      if (log.previousHash !== prevLog.hash) {
        return { valid: false, errorAt: i, message: 'Hash chain broken: previousHash does not match' };
      }
    }
  }
  
  return { valid: true, logsVerified: logs.length };
};

export default mongoose.model('AuditLog', AuditLogSchema);
