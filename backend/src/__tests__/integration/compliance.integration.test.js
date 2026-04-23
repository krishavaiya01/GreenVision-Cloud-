// backend/src/__tests__/integration/compliance.integration.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import auditLogService from '../../services/audit-log-service.js';
import AuditLog from '../../models/AuditLog.js';

// Setup minimal Express app for testing
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 'test-user-123' };
  next();
});

// Simple audit log endpoint for testing
app.post('/api/audit-logs', async (req, res) => {
  try {
    const log = await auditLogService.createAuditLog({
      userId: req.user.id,
      action: req.body.action,
      resourceType: req.body.resourceType,
      resourceId: req.body.resourceId,
      details: req.body.details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await auditLogService.getAuditLogs(req.user.id, {
      action: req.query.action,
      resourceType: req.query.resourceType,
      limit: req.query.limit
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs/verify/chain', async (req, res) => {
  try {
    const result = await auditLogService.verifyChainIntegrity(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs/:logId/verify', async (req, res) => {
  try {
    const result = await auditLogService.verifyLogIntegrity(req.params.logId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

describe('Compliance Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/greenvision-test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Cleanup test data
    await AuditLog.deleteMany({ userId: 'test-user-123' });
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clean after each test to avoid interference between tests
    await AuditLog.deleteMany({ userId: 'test-user-123' });
  });

  describe('POST /api/audit-logs', () => {
    it('should create audit log with correct hash', async () => {
      const res = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-123',
          details: { cpuUsage: 45 }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hash).toBeDefined();
      expect(res.body.data.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(res.body.data.previousHash).toBeNull();
    });

    it('should link second log with previousHash', async () => {
      // Create first log
      const res1 = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-123',
          details: { cpuUsage: 45 }
        });

      const firstHash = res1.body.data.hash;

      // Create second log
      const res2 = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'UPDATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-123',
          details: { cpuUsage: 60 }
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.previousHash).toBe(firstHash);
      expect(res2.body.data.hash).not.toBe(firstHash);
    });
  });

  describe('GET /api/audit-logs', () => {
    it('should retrieve all logs for user', async () => {
      // Create 3 logs
      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'UPDATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-2',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'DELETE',
          resourceType: 'User',
          resourceId: 'user-1',
          details: {}
        });

      const res = await request(app).get('/api/audit-logs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    it('should filter logs by action', async () => {
      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'UPDATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-2',
          details: {}
        });

      const res = await request(app).get('/api/audit-logs?action=CREATE');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('CREATE');
    });

    it('should filter logs by resourceType', async () => {
      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'User',
          resourceId: 'user-1',
          details: {}
        });

      const res = await request(app).get('/api/audit-logs?resourceType=CloudMetrics');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].resourceType).toBe('CloudMetrics');
    });
  });

  describe('GET /api/audit-logs/verify/chain', () => {
    it('should verify valid chain', async () => {
      // Create 3 linked logs
      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'UPDATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'DELETE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      const res = await request(app).get('/api/audit-logs/verify/chain');

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.logsVerified).toBe(3);
    });

    it('should detect broken chain', async () => {
      // Create 2 linked logs
      const res1 = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      const res2 = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'UPDATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: {}
        });

      // Manually tamper with first log's hash
      await AuditLog.updateOne(
        { _id: res1.body.data._id },
        { hash: 'tampered-hash-123456789' }
      );

      const verifyRes = await request(app).get('/api/audit-logs/verify/chain');

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.valid).toBe(false);
    });
  });

  describe('GET /api/audit-logs/:logId/verify', () => {
    it('should verify intact log', async () => {
      const createRes = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: { cpuUsage: 45 }
        });

      const logId = createRes.body.data._id;

      const verifyRes = await request(app).get(`/api/audit-logs/${logId}/verify`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.valid).toBe(true);
    });

    it('should detect tampered log', async () => {
      const createRes = await request(app)
        .post('/api/audit-logs')
        .send({
          action: 'CREATE',
          resourceType: 'CloudMetrics',
          resourceId: 'metric-1',
          details: { cpuUsage: 45 }
        });

      const logId = createRes.body.data._id;

      // Tamper with log details
      await AuditLog.updateOne(
        { _id: logId },
        { details: { cpuUsage: 99 } }
      );

      const verifyRes = await request(app).get(`/api/audit-logs/${logId}/verify`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.valid).toBe(false);
      expect(verifyRes.body.data.message).toContain('tampered');
    });
  });

  describe('Hash Chain Integrity', () => {
    it('should create proper chain structure', async () => {
      // Create 5 logs
      const logs = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/audit-logs')
          .send({
            action: 'CREATE',
            resourceType: 'CloudMetrics',
            resourceId: `metric-${i}`,
            details: { index: i }
          });
        logs.push(res.body.data);
      }

      // Verify chain structure
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i].previousHash).toBe(logs[i - 1].hash);
      }

      // First log should have no previousHash
      expect(logs[0].previousHash).toBeNull();
    });
  });
});
