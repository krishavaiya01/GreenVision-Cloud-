import mongoose from 'mongoose';

// Persisted issues (error/warn) extracted from raw logs; kept longer via TTL
const AwsIssueLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logGroup: { type: String, required: true, index: true },
  logStream: { type: String, default: null },
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
AwsIssueLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AwsIssueLogSchema.pre('validate', function(next) {
  const days = parseInt(process.env.AWS_LOG_RETAIN_DAYS || '30', 10);
  if (!this.expiresAt) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.expiresAt = d;
  }
  next();
});

export default mongoose.model('AwsIssueLog', AwsIssueLogSchema);
