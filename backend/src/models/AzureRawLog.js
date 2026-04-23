import mongoose from 'mongoose';

// Temporary buffer for raw Azure Log Analytics events.
// Kept briefly (TTL) to allow window processing, then auto-purged.
const AzureRawLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logGroup: { type: String, required: true, index: true }, // e.g., AzureActivity / Category
  logStream: { type: String, default: null }, // e.g., CorrelationId / OperationName
  timestamp: { type: Date, required: true, index: true },
  message: { type: String, required: true },
  windowStart: { type: Date, required: true, index: true },
  processed: { type: Boolean, default: false, index: true },
  expireAt: { type: Date, required: true }, // TTL index defined below
}, {
  timestamps: true,
  versionKey: false,
});

// TTL index for raw buffer
AzureRawLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

AzureRawLogSchema.pre('validate', function(next) {
  const WINDOW_MS = parseInt(process.env.AZURE_LOGS_WINDOW_MS || '60000', 10); // default 1 min
  const RAW_TTL_MIN = parseInt(process.env.AZURE_LOGS_RAW_TTL_MIN || '15', 10); // keep raw at least 15 min
  const ts = this.timestamp ? this.timestamp.getTime() : Date.now();
  const ws = Math.floor(ts / WINDOW_MS) * WINDOW_MS;
  if (!this.windowStart) this.windowStart = new Date(ws);
  if (!this.expireAt) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + RAW_TTL_MIN);
    this.expireAt = d;
  }
  next();
});

export default mongoose.model('AzureRawLog', AzureRawLogSchema);
