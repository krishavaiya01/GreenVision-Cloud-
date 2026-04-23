import mongoose from 'mongoose';

// Persisted issues (error/warn) extracted from Azure logs; kept longer via TTL
const AzureIssueLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logGroup: { type: String, required: true, index: true }, // e.g., AzureActivity/Category
  logStream: { type: String, default: null }, // e.g., OperationName or CorrelationId
  timestamp: { type: Date, required: true, index: true },
  level: { type: String, enum: ['error', 'warn'], required: true, index: true },
  message: { type: String, required: true },
  context: { type: Object, default: {} },
  expiresAt: { type: Date, required: true }, // TTL index defined below
}, {
  timestamps: true,
  versionKey: false,
});

// TTL index for issues retention window
AzureIssueLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AzureIssueLogSchema.pre('validate', function(next) {
  const days = parseInt(process.env.AZURE_LOG_RETAIN_DAYS || '30', 10);
  if (!this.expiresAt) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.expiresAt = d;
  }
  next();
});

export default mongoose.model('AzureIssueLog', AzureIssueLogSchema);
