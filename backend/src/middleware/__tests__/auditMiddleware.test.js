// src/middleware/__tests__/auditMiddleware.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import createAuditMiddleware from '../auditMiddleware.js';
import auditLogService from '../../services/audit-log-service.js';

vi.mock('../../services/audit-log-service.js', () => ({
  default: {
    createAuditLog: vi.fn().mockResolvedValue({ _id: 'log-123', hash: 'abc' })
  }
}));

describe('auditMiddleware', () => {
  let middleware;
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create audit middleware with test routes
    middleware = createAuditMiddleware([
      '/api/auth/login',
      /\/api\/.*\/delete/i
    ]);

    // Mock request
    req = {
      method: 'POST',
      path: '/api/auth/login',
      user: { id: 'user-123' },
      body: { email: 'test@test.com', password: 'secret123' },
      query: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: vi.fn((header) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        return '';
      })
    };

    // Mock response
    res = {
      statusCode: 200,
      send: vi.fn((data) => data),
      setHeader: vi.fn()
    };

    next = vi.fn();
  });

  it('should pass through middleware without error', () => {
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should create audit log for sensitive routes', async () => {
    middleware(req, res, next);
    
    // Call the overridden send
    const originalSend = res.send;
    res.send('success');

    // Wait for async audit log creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify audit log was created
    expect(auditLogService.createAuditLog).toHaveBeenCalled();
  });

  it('should not log non-sensitive routes', () => {
    req.path = '/api/auth/me';
    middleware(req, res, next);
    
    res.send('data');

    // Audit log should not be created for non-sensitive routes
    expect(auditLogService.createAuditLog).not.toHaveBeenCalled();
  });

  it('should sanitize sensitive fields', async () => {
    req.body = {
      email: 'test@test.com',
      password: 'secret123',
      apiKey: 'secret-key'
    };

    middleware(req, res, next);
    res.send('success');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that sensitive fields are redacted
    const callArgs = auditLogService.createAuditLog.mock.calls[0][0];
    expect(callArgs.details.body.password).toBe('[REDACTED]');
    expect(callArgs.details.body.apiKey).toBe('[REDACTED]');
    expect(callArgs.details.body.email).toBe('test@test.com');
  });

  it('should capture response status code', async () => {
    res.statusCode = 201;
    middleware(req, res, next);
    res.send('created');

    await new Promise(resolve => setTimeout(resolve, 100));

    const callArgs = auditLogService.createAuditLog.mock.calls[0][0];
    expect(callArgs.details.statusCode).toBe(201);
  });

  it('should determine action from HTTP method', async () => {
    req.method = 'POST';
    middleware(req, res, next);
    res.send('created');

    await new Promise(resolve => setTimeout(resolve, 100));

    let callArgs = auditLogService.createAuditLog.mock.calls[0][0];
    expect(callArgs.action).toBe('CREATE');

    auditLogService.createAuditLog.mockClear();

    req.method = 'GET';
    middleware(req, res, next);
    res.send('data');

    await new Promise(resolve => setTimeout(resolve, 100));

    callArgs = auditLogService.createAuditLog.mock.calls[0][0];
    expect(callArgs.action).toBe('READ');
  });

  it('should handle regex route matching', async () => {
    req.path = '/api/users/delete';
    req.method = 'DELETE';
    middleware(req, res, next);
    res.send('deleted');

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(auditLogService.createAuditLog).toHaveBeenCalled();
  });

  it('should capture IP address and user agent', async () => {
    middleware(req, res, next);
    res.send('success');

    await new Promise(resolve => setTimeout(resolve, 100));

    const callArgs = auditLogService.createAuditLog.mock.calls[0][0];
    expect(callArgs.ipAddress).toBe('127.0.0.1');
    expect(callArgs.userAgent).toBe('Mozilla/5.0');
  });
});
