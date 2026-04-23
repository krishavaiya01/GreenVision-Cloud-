# Immutable Audit Logs - Testing & Verification Guide

## Quick Start - Run Tests

### Backend Tests

```bash
# Navigate to backend
cd backend

# Install dependencies (if needed)
npm install

# Run all tests
npm run test

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test -- src/services/__tests__/audit-log-service.test.js

# Run integration tests
npm run test -- src/__tests__/integration/compliance.integration.test.js

# Run middleware tests
npm run test -- src/middleware/__tests__/auditMiddleware.test.js
```

### Frontend Tests

```bash
# Navigate to frontend
cd frontend

# Install testing dependencies (if not already installed)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test

# Run with UI
npm run test:ui
```

## Test Structure

### 1. Unit Tests - Audit Log Service
**File:** `backend/src/services/__tests__/audit-log-service.test.js`

**Coverage:**
- ✅ Hash creation with correct SHA-256 format
- ✅ Chain linking with previousHash
- ✅ Error handling for missing parameters
- ✅ Filtering logs by action, resourceType, resourceId, status
- ✅ Chain integrity verification (detects broken chains)
- ✅ Single log integrity verification (detects tampering)
- ✅ Resource audit trail retrieval
- ✅ CSV export with hash chain columns
- ✅ Audit statistics aggregation

**Key Tests:**
```javascript
// Hash Creation Test
it('should create audit log with SHA-256 hash', async () => {
  const log = await createAuditLog({
    userId: 'user-123',
    action: 'CREATE',
    resourceType: 'CloudMetrics',
    resourceId: 'metric-1',
    details: { cpuUsage: 45 }
  });
  
  expect(log.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
});

// Chain Linking Test
it('should link second log with previousHash', async () => {
  const log1 = await createAuditLog({ ... });
  const log2 = await createAuditLog({ ... });
  
  expect(log2.previousHash).toBe(log1.hash);
});

// Tampering Detection Test
it('should detect tampered log', async () => {
  const log = await createAuditLog({ ... });
  
  // Manually modify details
  await AuditLog.updateOne({ _id: log._id }, { details: { ...modified } });
  
  const result = await verifyLogIntegrity(log._id);
  expect(result.valid).toBe(false);
});
```

### 2. Unit Tests - Audit Middleware
**File:** `backend/src/middleware/__tests__/auditMiddleware.test.js`

**Coverage:**
- ✅ Middleware passes through without blocking
- ✅ Creates audit logs for sensitive routes
- ✅ Skips non-sensitive routes
- ✅ Sanitizes sensitive fields (password, apiKey, token, etc.)
- ✅ Captures response status codes
- ✅ Determines action from HTTP method (POST→CREATE, GET→READ, etc.)
- ✅ Regex route matching
- ✅ Captures IP address and user agent

**Key Tests:**
```javascript
// Sensitive Route Detection
it('should create audit log for sensitive routes', async () => {
  const middleware = createAuditMiddleware(['/api/auth/login']);
  middleware(mockRequest, mockResponse, mockNext);
  
  expect(auditLogService.createAuditLog).toHaveBeenCalled();
});

// Credential Sanitization
it('should sanitize sensitive fields', async () => {
  const middleware = createAuditMiddleware(['/api/auth/login']);
  req.body = { email: 'test@test.com', password: 'secret' };
  
  middleware(req, res, next);
  
  // Password should be redacted
  expect(capturedLog.details.body.password).toBe('[REDACTED]');
});

// Non-Blocking Behavior
it('should not block response', () => {
  const middleware = createAuditMiddleware([...]);
  middleware(req, res, next);
  
  expect(next).toHaveBeenCalled();
});
```

### 3. Integration Tests - Compliance Endpoints
**File:** `backend/src/__tests__/integration/compliance.integration.test.js`

**Coverage:**
- ✅ Create audit logs via HTTP POST
- ✅ Retrieve logs with filters
- ✅ Verify chain integrity via HTTP
- ✅ Verify single log integrity
- ✅ Hash chain structure validation
- ✅ Tampering detection in integrated flow

**Key Tests:**
```javascript
// End-to-End Chain Verification
it('should verify valid chain of 5 logs', async () => {
  // Create 5 logs
  const logs = [];
  for (let i = 0; i < 5; i++) {
    const res = await request(app)
      .post('/api/audit-logs')
      .send({ action: 'CREATE', ... });
    logs.push(res.body.data);
  }
  
  // Verify chain structure
  const verifyRes = await request(app).get('/api/audit-logs/verify/chain');
  expect(verifyRes.body.data.valid).toBe(true);
  expect(verifyRes.body.data.logsVerified).toBe(5);
});

// Tampering Detection in Flow
it('should detect tampered log in chain', async () => {
  const res1 = await request(app)
    .post('/api/audit-logs')
    .send({ ... });
  
  // Create second log to verify linkage
  await request(app)
    .post('/api/audit-logs')
    .send({ ... });
  
  // Tamper with first log
  await AuditLog.updateOne(
    { _id: res1.body.data._id },
    { hash: 'tampered' }
  );
  
  // Chain verification should fail
  const verifyRes = await request(app).get('/api/audit-logs/verify/chain');
  expect(verifyRes.body.data.valid).toBe(false);
});
```

## Manual Testing Workflows

### 1. Test Hash Chain Creation

**Using cURL:**
```bash
# Create first audit log
curl -X POST http://localhost:5050/api/compliance/audit-logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CREATE",
    "resourceType": "CloudMetrics",
    "resourceId": "metric-123",
    "details": { "cpuUsage": 45 }
  }'

# Note the returned hash
# Response: { hash: "abc123def456..." }

# Create second audit log
curl -X POST http://localhost:5050/api/compliance/audit-logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UPDATE",
    "resourceType": "CloudMetrics",
    "resourceId": "metric-123",
    "details": { "cpuUsage": 60 }
  }'

# The previousHash should match the first log's hash
# Response: { hash: "xyz789uvw...", previousHash: "abc123def456..." }
```

**Using Frontend:**
1. Navigate to Compliance Dashboard
2. View "Audit Logs" table
3. Observe that each log shows the previous hash linkage
4. Click "Verify Chain Integrity" button
5. Should show "✅ Chain Valid - All logs properly linked"

### 2. Test Tampering Detection

**Using MongoDB CLI:**
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/greenvision

# View an audit log
db.auditlogs.findOne({ userId: "your-user-id" })

# Manually modify a log's details
db.auditlogs.updateOne(
  { _id: ObjectId("log-id-here") },
  { $set: { "details.cpuUsage": 999 } }
)

# Now verify the log via API
curl http://localhost:5050/api/compliance/audit-logs/log-id-here/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response should show:
# { valid: false, message: "Log has been tampered with", storedHash: "...", expectedHash: "..." }
```

### 3. Test Sensitive Route Auto-Logging

**Using cURL - Trigger Auth Route:**
```bash
# This route is in sensitiveRoutes, so it auto-logs
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secret123"
  }'

# Now query audit logs to see the login was captured
curl http://localhost:5050/api/compliance/audit-logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Should show a log with:
# { action: "CREATE", resourceType: "auth", ... }
# Note: password is sanitized as [REDACTED]
```

### 4. Test CSV Export

**Using cURL:**
```bash
# Export all logs as CSV
curl http://localhost:5050/api/compliance/audit-logs/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o audit-logs.csv

# Open audit-logs.csv in spreadsheet app
# Should contain columns: Timestamp, Action, ResourceType, Status, Hash, PreviousHash, Details
```

**Using Frontend:**
1. Go to Compliance Dashboard
2. Set any filters (optional)
3. Click "Export to CSV" button
4. File downloads as `audit-logs-TIMESTAMP.csv`

## Test Data Scenarios

### Scenario 1: Complete Audit Trail
```
User Action Flow:
1. CREATE CloudMetrics metric-1 → hash: ABC...
2. UPDATE CloudMetrics metric-1 → previousHash: ABC..., hash: DEF...
3. DELETE CloudMetrics metric-1 → previousHash: DEF..., hash: GHI...

Chain Verification:
✅ All 3 logs properly linked
✅ No tampering detected
```

### Scenario 2: Failed Operation Detection
```
1. POST /api/cloud/resources with invalid data
   → Status: failure, action: CREATE
   → Log captures error message

2. Query by status:filter
   curl "/api/compliance/audit-logs?status=failure"
   
   → Returns only failed operations
```

### Scenario 3: Resource-Specific Audit Trail
```
1. Multiple operations on same resource
   POST /api/cloudmetrics/metric-123 → CREATE
   GET /api/cloudmetrics/metric-123 → READ
   PUT /api/cloudmetrics/metric-123 → UPDATE
   DELETE /api/cloudmetrics/metric-123 → DELETE

2. Query resource trail:
   curl "/api/compliance/audit-logs/trail/CloudMetrics/metric-123"
   
   → Returns all 4 operations in chronological order
   → Each shows previous hash linkage
```

## Debugging Tips

### Check if Middleware is Logging

**Add Console Logs:**
```javascript
// In auditMiddleware.js
app.use(createAuditMiddleware(sensitiveRoutes));

// Should see in console:
// "✅ Sensitive route matched: /api/auth/login"
// "📝 Audit log created for POST /api/auth/login"
```

### Verify Hash Generation

**Test Hash Consistency:**
```javascript
// Same input should always produce same hash
const hash1 = crypto.createHash('sha256')
  .update(JSON.stringify(data))
  .digest('hex');

const hash2 = crypto.createHash('sha256')
  .update(JSON.stringify(data))
  .digest('hex');

// hash1 === hash2 should be true
```

### Check Database Indexes

**In MongoDB:**
```bash
# View indexes on auditlogs collection
db.auditlogs.getIndexes()

# Should show:
# - { userId: 1, createdAt: -1 }  → for audit trails
# - { action: 1, createdAt: -1 }  → for action history
# - { chainVerified: 1, createdAt: -1 }  → for integrity checks
```

## Expected Test Results

### Running All Tests
```bash
npm run test

PASS  src/services/__tests__/audit-log-service.test.js (7 describe blocks, 20+ tests)
  ✓ createAuditLog (3 tests)
  ✓ getAuditLogs (4 tests)
  ✓ verifyChainIntegrity (2 tests)
  ✓ verifyLogIntegrity (2 tests)
  ✓ getResourceAuditTrail (1 test)
  ✓ exportAuditLogsAsCSV (2 tests)
  ✓ getAuditStatistics (1 test)

PASS  src/middleware/__tests__/auditMiddleware.test.js (8 tests)
  ✓ passes through middleware
  ✓ creates audit log for sensitive routes
  ✓ skips non-sensitive routes
  ✓ sanitizes sensitive fields
  ✓ captures status code
  ✓ determines action from method
  ✓ regex route matching
  ✓ captures IP and user agent

PASS  src/__tests__/integration/compliance.integration.test.js (4 describe blocks, 15+ tests)
  ✓ POST /api/audit-logs
  ✓ GET /api/audit-logs
  ✓ GET /api/audit-logs/verify/chain
  ✓ GET /api/audit-logs/:logId/verify
  ✓ Hash Chain Integrity

Test Suites: 3 passed, 3 total
Tests:       43+ passed, 43+ total
Time:        5-10s
```

## Performance Testing

### Load Test - Create 1000 Logs

```bash
# Using Apache Bench
ab -n 1000 -c 10 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -p log-payload.json \
  http://localhost:5050/api/compliance/audit-logs

# Expected performance:
# - Time per request: < 50ms
# - Throughput: > 100 requests/sec
# - All hashes unique and properly linked
```

### Chain Verification Performance

```bash
# Verify chain of 10,000 logs
curl http://localhost:5050/api/compliance/audit-logs/verify/chain \
  -H "Authorization: Bearer TOKEN"

# Expected:
# - Response time: < 500ms
# - Memory usage: < 100MB
# - Verification result: valid/invalid + number of logs checked
```

## Compliance Validation

### GDPR Data Export
```bash
# Export user's complete audit trail
curl "http://localhost:5050/api/compliance/audit-logs?userId=user-123" \
  -H "Authorization: Bearer TOKEN" \
  > user-audit-export.json

# Contains: all user's actions, timestamps, resource modifications
# Can be provided as user data export for GDPR requests
```

### HIPAA Audit Requirements
```bash
# Filter audit logs for compliance date range
curl "http://localhost:5050/api/compliance/audit-logs?startDate=2024-01-01&endDate=2024-03-31" \
  -H "Authorization: Bearer TOKEN"

# All logs have:
# ✅ Immutable timestamps
# ✅ User ID
# ✅ Action performed
# ✅ Resource modified
# ✅ Status (success/failure)
# ✅ Hash chain proof
```

## Troubleshooting

### Issue: Hash Chain Broken
**Solution:**
```bash
# Get chain integrity status
curl http://localhost:5050/api/compliance/audit-logs/verify/chain \
  -H "Authorization: Bearer TOKEN"

# If broken, identify where:
# { errorAt: 5, message: "previousHash mismatch at log index 5" }

# View logs around error point
db.auditlogs.find({ userId: "user-id" }).skip(4).limit(3)

# Check if any log was manually modified
# Restore from backup if necessary
```

### Issue: Performance Degradation with 100K+ Logs
**Solution:**
```javascript
// Use pagination for large datasets
curl "http://localhost:5050/api/compliance/audit-logs?limit=100&offset=0" \
  -H "Authorization: Bearer TOKEN"

// Implement archive strategy
// Move old logs (> 2 years) to cold storage
// Keep active logs (< 2 years) in hot storage
```

### Issue: Middleware Not Logging
**Solution:**
1. Check sensitiveRoutes regex patterns match your route
2. Verify middleware is registered BEFORE routes: `app.use(createAuditMiddleware(...))` before `app.use("/api/...", routes)`
3. Ensure user is authenticated (req.user.id exists)
4. Check MongoDB connection status
5. Review browser console and server logs for errors

---

## Next Steps

1. ✅ Run all tests: `npm run test`
2. ✅ Verify frontend compliance dashboard works
3. ⏳ Phase 2: Integrate Stellar blockchain (see blockchain-audit-service.js for guide)
4. ⏳ Phase 3: Set up automated compliance reports (monthly/quarterly)
5. ⏳ Phase 4: Zero-trust architecture with immutable proofs

