import mongoose from 'mongoose';

const GcpRawLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logName: { type: String, required: true, index: true },
  resource: { type: String, default: null },
  timestamp: { type: Date, required: true, index: true },
  severity: { type: String, index: true, default: '' },
  message: { type: String, required: true },
  windowStart: { type: Date, required: true, index: true },
  processed: { type: Boolean, default: false, index: true },
  expireAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

GcpRawLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

GcpRawLogSchema.pre('validate', function(next) {
  const WINDOW_MS = parseInt(process.env.GCP_LOGS_WINDOW_MS || '60000', 10);
  const RAW_TTL_MIN = parseInt(process.env.GCP_LOGS_RAW_TTL_MIN || '15', 10);
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

export default mongoose.model('GcpRawLog', GcpRawLogSchema);
