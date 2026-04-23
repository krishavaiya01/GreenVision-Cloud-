# GreenVision Cloud - Immutable Audit Logs Quick Reference

## 🚀 Quick Start

### Start Backend with Audit Logging
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:5050
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

### Access Compliance Dashboard
```
http://localhost:5173/dashboard/compliance
```

---

## 📊 API Endpoints Summary

### Audit Log Management

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/compliance/audit-logs` | Create audit log | ✅ Required |
| GET | `/api/compliance/audit-logs` | List all logs | ✅ Required |
| GET | `/api/compliance/audit-logs/:logId/verify` | Verify single log | ✅ Required |
| GET | `/api/compliance/audit-logs/verify/chain` | Verify chain integrity | ✅ Required |
| GET | `/api/compliance/audit-logs/trail/:resourceType/:resourceId` | Get resource audit trail | ✅ Required |
| GET | `/api/compliance/audit-logs/export` | Export as CSV | ✅ Required |
| GET | `/api/compliance/audit-logs/statistics` | Get audit statistics | ✅ Required |

### Query Parameters

```bash
# Filter by action
/api/compliance/audit-logs?action=CREATE

# Filter by resource type
/api/compliance/audit-logs?resourceType=CloudMetrics

# Filter by status
/api/compliance/audit-logs?status=success

# Filter by date range
/api/compliance/audit-logs?startDate=2024-01-01&endDate=2024-12-31

# Limit results
/api/compliance/audit-logs?limit=50
```

---

## 🔐 Hash Chain Mechanics

### How It Works
```
Log 1: hash = SHA256(user + action + timestamp + resource + details)
       previousHash = null

Log 2: hash = SHA256(user + action + timestamp + resource + details)
       previousHash = Log1.hash  ← Links to previous!

Log 3: hash = SHA256(user + action + timestamp + resource + details)
       previousHash = Log2.hash  ← Unbroken chain!
```

### Tampering Detection
```
If someone modifies Log 2's details:
- Expected hash (recalculated) ≠ Stored hash
- Chain breaks: Log3.previousHash ≠ modified_Log2.hash
- System detects tampering ✗
```

---

## 🧪 Testing Commands

### Run All Tests
```bash
cd backend
npm run test
```

### Run Specific Test Suite
```bash
# Audit service tests
npm run test -- src/services/__tests__/audit-log-service.test.js

# Middleware tests
npm run test -- src/middleware/__tests__/auditMiddleware.test.js

# Integration tests
npm run test -- src/__tests__/integration/compliance.integration.test.js
```

### Run Tests with UI
```bash
npm run test:ui
```

---

## 🎯 Sensitive Routes (Auto-Logged)

These routes automatically create audit logs without any code changes:

```javascript
✅ /api/auth/login              → CREATE action
✅ /api/auth/signup             → CREATE action
✅ /api/auth/password           → UPDATE action
✅ /api/cloudmetrics/*          → Appropriate action
✅ /api/ai/recommendations      → READ action
✅ /api/ai/rightsizing          → READ action
✅ /api/cloud/*                 → Appropriate action
✅ /api/compliance/*            → All compliance routes
✅ /api/*/(update|delete)       → UPDATE/DELETE actions
```

---

## 📋 Database Schema

### AuditLog Collection
```javascript
{
  _id: ObjectId,
  userId: "user-123",              // Who did it
  action: "CREATE|READ|UPDATE|DELETE|LOGIN",  // What action
  resourceType: "CloudMetrics",    // What resource type
  resourceId: "metric-123",        // Specific resource ID
  details: { /* what changed */ },
  hash: "abc123def456...",         // SHA-256 (64 chars)
  previousHash: "xyz789uvw...",    // Links to prior log
  createdAt: ISODate,              // Immutable timestamp
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0",
  status: "success|failure|partial",
  errorMessage: "",
  chainVerified: true              // Verification flag
}
```

### Indexes
```javascript
// Fast audit trails
{ userId: 1, createdAt: -1 }

// Action-based queries
{ action: 1, createdAt: -1 }

// Chain integrity checks
{ chainVerified: 1, createdAt: -1 }
```

---

## 🛠️ Common Development Tasks

### Add a New Route to Audit Logging

In `backend/src/index.js`:
```javascript
// Find sensitiveRoutes array
const sensitiveRoutes = [
  // ... existing patterns
  /^\/api\/my-new-route\/sensitive-action$/  // Add this
];
```

That's it! The route is now auto-logged.

### Check Audit Logs in MongoDB

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/greenvision

# View all logs for a user
db.auditlogs.find({ userId: "user-id-here" }).pretty()

# View by action
db.auditlogs.find({ action: "DELETE" }).sort({ createdAt: -1 }).limit(10)

# View broken chains
db.auditlogs.find({ chainVerified: false })

# Count logs per user
db.auditlogs.aggregate([
  { $group: { _id: "$userId", count: { $sum: 1 } } }
])
```

### Manually Verify a Log's Integrity

```javascript
// In Node REPL or service
import { verifyLogIntegrity } from './services/audit-log-service.js';

const result = await verifyLogIntegrity('log-id-here');
// Returns: { valid: true/false, message: "...", expectedHash, storedHash }
```

---

## 📱 Frontend Integration

### ComplianceDashboard Component
Location: `frontend/src/pages/dashboard/ComplianceDashboard.jsx`

Features:
- 📊 Statistics cards (total logs, success rate, etc.)
- 🔗 Chain integrity button
- 🔍 Filter form (action, resource type, status)
- 📝 Audit logs table with hash preview
- 📄 CSV export button
- 🔎 Click-to-details modal

### Use ComplianceDashboard in Your Routes

```jsx
import ComplianceDashboard from './pages/dashboard/ComplianceDashboard.jsx';

// In your router
<Route path="/dashboard/compliance" element={<ComplianceDashboard />} />
```

---

## 🔔 Middleware Auto-Logging Flow

```
1. Request arrives at sensitive route
   ↓
2. Route handler executes (not blocked)
   ↓
3. Response is sent
   ↓
4. Middleware intercepts response
   ↓
5. Captures: method, path, status, body (sanitized), IP, user-agent
   ↓
6. Determines action: POST→CREATE, PUT→UPDATE, DELETE→DELETE, etc.
   ↓
7. Extracts resource info from path
   ↓
8. Creates audit log (async, non-blocking)
   ↓
9. Hash links to previous log's hash
   ↓
✅ Chain link established!
```

---

## ⚠️ Troubleshooting

### Audit logs not being created
```bash
# Check if middleware is registered BEFORE routes
grep -n "app.use(createAuditMiddleware" backend/src/index.js
# Should appear BEFORE: app.use("/api/auth", authRoutes)

# Verify MongoDB is running
mongosh mongodb://localhost:27017/greenvision

# Check if user is authenticated
# Middleware uses req.user.id from JWT token
```

### Hash chain shows as broken
```bash
# Verify chain integrity
curl http://localhost:5050/api/compliance/audit-logs/verify/chain \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check specific log
curl http://localhost:5050/api/compliance/audit-logs/LOG_ID/verify \
  -H "Authorization: Bearer YOUR_TOKEN"

# If broken, it means the log was tampered with!
```

### Performance issues with 100K+ logs
```bash
# Use pagination
/api/compliance/audit-logs?limit=100&offset=500

# Archive old logs (>2 years)
# Move to cold storage, keep hot storage for recent logs

# Add database indexes if missing
db.auditlogs.createIndex({ userId: 1, createdAt: -1 })
db.auditlogs.createIndex({ action: 1, createdAt: -1 })
```

---

## 📚 File Structure

```
backend/
├── src/
│   ├── models/
│   │   └── AuditLog.js              # Schema
│   ├── services/
│   │   ├── audit-log-service.js     # Business logic
│   │   └── blockchain-audit-service.js  # Phase 2
│   ├── controllers/
│   │   └── ComplianceController.js  # HTTP handlers
│   ├── routes/
│   │   └── compliance.js            # Routes
│   ├── middleware/
│   │   └── auditMiddleware.js       # Auto-logging
│   └── __tests__/
│       ├── services/
│       │   └── audit-log-service.test.js
│       ├── middleware/
│       │   └── auditMiddleware.test.js
│       └── integration/
│           └── compliance.integration.test.js

frontend/
└── src/
    └── pages/
        └── dashboard/
            └── ComplianceDashboard.jsx
```

---

## 🎓 Learning Path

1. **Read** → `IMMUTABLE_AUDIT_LOGS_IMPLEMENTATION.md` (architecture)
2. **Run Tests** → `npm run test` (verify everything works)
3. **Try API** → Use cURL/Postman to create/verify logs
4. **Explore UI** → Navigate to compliance dashboard
5. **Deploy** → Use in production with blockchain Phase 2

---

## 📞 Support

For issues or questions:
1. Check `TESTING_GUIDE.md` for debugging tips
2. Review test files for usage examples
3. Check MongoDB indexes and data integrity
4. Review middleware logs in console

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** ✅ Production Ready  
**Phase 2 (Blockchain):** 🔄 In Roadmap
