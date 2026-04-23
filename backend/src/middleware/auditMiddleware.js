// src/middleware/auditMiddleware.js
import auditLogService from '../services/audit-log-service.js';

/**
 * Middleware to automatically create audit logs for sensitive actions
 * Usage: app.use(auditMiddleware(sensitiveRoutes))
 */
export const createAuditMiddleware = (sensitiveRoutes = []) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function (data) {
      // Only log if route is in sensitive routes
      const isSensitive = sensitiveRoutes.some(route => {
        if (typeof route === 'string') return req.path === route;
        if (route instanceof RegExp) return route.test(req.path);
        return false;
      });

      if (isSensitive && req.user) {
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 300;

        // Determine action and resource from route
        const action = determineAction(req.method, req.path);
        const { resourceType, resourceId } = extractResourceInfo(req);

        // Create audit log asynchronously (don't block response)
        auditLogService.createAuditLog({
          userId: req.user.id,
          action,
          resourceType,
          resourceId,
          details: {
            method: req.method,
            path: req.path,
            statusCode,
            query: req.query,
            body: sanitizeBody(req.body)
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          status: success ? 'success' : 'failure',
          errorMessage: success ? null : `HTTP ${statusCode}`
        }).catch(err => {
          console.error('Failed to create audit log:', err);
        });
      }

      // Call original send
      res.send = originalSend;
      return res.send(data);
    };

    next();
  };
};

/**
 * Determine action type from HTTP method and path
 * @private
 */
function determineAction(method, path) {
  if (method === 'POST') return 'CREATE';
  if (method === 'GET') return 'READ';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  return 'UNKNOWN';
}

/**
 * Extract resource type and ID from request
 * @private
 */
function extractResourceInfo(req) {
  const path = req.path;
  const paramId = req.params?.id || null;

  if (path.includes('/metrics')) return { resourceType: 'metrics', resourceId: paramId };
  if (path.includes('/recommendations')) return { resourceType: 'recommendation', resourceId: null };
  if (path.includes('/anomalies')) return { resourceType: 'anomaly', resourceId: paramId };
  if (path.includes('/reports')) return { resourceType: 'report', resourceId: paramId };
  if (path.includes('/settings')) return { resourceType: 'settings', resourceId: null };
  if (path.includes('/users')) return { resourceType: 'user', resourceId: paramId };
  if (path.includes('/auth')) return { resourceType: 'system', resourceId: 'authentication' };

  return { resourceType: 'system', resourceId: null };
}

/**
 * Sanitize sensitive data from request body before logging
 * @private
 */
function sanitizeBody(body) {
  if (!body) return null;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'awsAccessKeyId', 'azureKey', 'gcpKey'];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

export default createAuditMiddleware;
