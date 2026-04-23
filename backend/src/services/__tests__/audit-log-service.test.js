// src/services/__tests__/audit-log-service.test.js
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import auditLogService from '../audit-log-service.js';
import AuditLog from '../../models/AuditLog.js';

// Mock user ID
const testUserId = new mongoose.Types.ObjectId().toString();

describe('AuditLogService', () => {
  beforeAll(async () => {
    // Connect to test database (use MongoDB Memory Server in CI)
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/greenvision-test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { retryWrites: false });
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test to ensure clean state
    await AuditLog.deleteMany({ userId: testUserId });
  });

  afterAll(async () => {
    // Clean up test data
    await AuditLog.deleteMany({ userId: testUserId });
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('createAuditLog', () => {
    it('creates audit log with correct hash', async () => {
      const log = await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'CREATE',
        resourceType: 'metrics',
        resourceId: 'metric-123',
        details: { field: 'cost', value: 100 }
      });

      expect(log).toBeDefined();
      expect(log.hash).toBeDefined();
      expect(log.hash).toHaveLength(64); // SHA-256 hex length
      expect(log.previousHash).toBeNull();
      expect(log.action).toBe('CREATE');
      expect(log.status).toBe('success');
    });

    it('creates second log with previous hash linked', async () => {
      const log1 = await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'CREATE',
        resourceType: 'user'
      });

      const log2 = await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'UPDATE',
        resourceType: 'user'
      });

      expect(log2.previousHash).toBe(log1.hash);
      expect(log1.previousHash).toBeNull();
    });

    it('throws error when userId is missing', async () => {
      await expect(
        auditLogService.createAuditLog({
          action: 'CREATE'
        })
      ).rejects.toThrow('userId and action are required');
    });

    it('throws error when action is missing', async () => {
      await expect(
        auditLogService.createAuditLog({
          userId: testUserId
        })
      ).rejects.toThrow('userId and action are required');
    });
  });

  describe('getAuditLogs', () => {
    it('retrieves logs for user', async () => {
      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'READ',
        resourceType: 'report'
      });

      const logs = await auditLogService.getAuditLogs(testUserId);

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('filters logs by action', async () => {
      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'DELETE',
        resourceType: 'file'
      });

      const logs = await auditLogService.getAuditLogs(testUserId, {
        action: 'DELETE'
      });

      expect(logs.every(log => log.action === 'DELETE')).toBe(true);
    });

    it('filters logs by resource type', async () => {
      const logs = await auditLogService.getAuditLogs(testUserId, {
        resourceType: 'metrics'
      });

      expect(logs.every(log => log.resourceType === 'metrics')).toBe(true);
    });

    it('respects limit parameter', async () => {
      const logs = await auditLogService.getAuditLogs(testUserId, {
        limit: 2
      });

      expect(logs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('verifyChainIntegrity', () => {
    it('verifies valid chain', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      
      await auditLogService.createAuditLog({
        userId,
        action: 'CREATE'
      });

      await auditLogService.createAuditLog({
        userId,
        action: 'UPDATE'
      });

      const result = await auditLogService.verifyChainIntegrity(userId);
      
      if (!result.valid) {
        console.log('Chain verification failed:', result);
      }

      expect(result.valid).toBe(true);
      expect(result.logsVerified).toBe(2);
    });

    it('detects broken chain', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      
      const log1 = await auditLogService.createAuditLog({
        userId,
        action: 'CREATE'
      });

      const log2 = await auditLogService.createAuditLog({
        userId,
        action: 'UPDATE'
      });

      // Tamper with log1
      await AuditLog.updateOne(
        { _id: log1._id },
        { details: { tampered: true } }
      );

      const result = await auditLogService.verifyChainIntegrity(userId);

      expect(result.valid).toBe(false);
      expect(result.errorAt).toBeDefined();
    });
  });

  describe('verifyLogIntegrity', () => {
    it('verifies intact log', async () => {
      const log = await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'CREATE',
        details: { test: 'data' }
      });

      const result = await auditLogService.verifyLogIntegrity(log._id);

      expect(result.valid).toBe(true);
    });

    it('detects tampered log', async () => {
      const log = await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'UPDATE',
        details: { original: 'data' }
      });

      // Tamper with log
      await AuditLog.updateOne(
        { _id: log._id },
        { details: { hacked: true } }
      );

      const result = await auditLogService.verifyLogIntegrity(log._id);

      expect(result.valid).toBe(false);
      expect(result.expectedHash).not.toBe(result.storedHash);
    });
  });

  describe('getResourceAuditTrail', () => {
    it('retrieves audit trail for specific resource', async () => {
      const resourceType = 'metrics';
      const resourceId = 'metric-test-123';

      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'CREATE',
        resourceType,
        resourceId
      });

      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'UPDATE',
        resourceType,
        resourceId
      });

      const trail = await auditLogService.getResourceAuditTrail(
        testUserId,
        resourceType,
        resourceId
      );

      expect(trail.length).toBe(2);
      expect(trail.every(log => log.resourceId === resourceId)).toBe(true);
    });
  });

  describe('exportAuditLogsAsCSV', () => {
    it('exports logs as CSV format', async () => {
      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'CREATE',
        resourceType: 'report'
      });

      const csv = await auditLogService.exportAuditLogsAsCSV(testUserId);

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Timestamp,Action');
      expect(csv).toContain('CREATE');
    });

    it('CSV contains hash chain', async () => {
      await auditLogService.createAuditLog({
        userId: testUserId,
        action: 'READ',
        resourceType: 'document'
      });

      const csv = await auditLogService.exportAuditLogsAsCSV(testUserId);

      expect(csv).toContain('PreviousHash');
      expect(csv).toContain('Hash');
    });
  });

  describe('getAuditStatistics', () => {
    it('calculates audit statistics', async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      await auditLogService.createAuditLog({
        userId,
        action: 'CREATE',
        status: 'success'
      });

      await auditLogService.createAuditLog({
        userId,
        action: 'UPDATE',
        status: 'success'
      });

      await auditLogService.createAuditLog({
        userId,
        action: 'DELETE',
        status: 'failure'
      });

      const stats = await auditLogService.getAuditStatistics(userId);

      expect(stats.totalLogs).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.uniqueActions.length).toBe(3);
    });
  });
});
