import mongoose from 'mongoose';

const GcpIssueLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logName: { type: String, required: true, index: true },
  resource: { type: String, default: null },
  timestamp: { type: Date, required: true, index: true },
  message: { type: String, required: true },
  level: { type: String, enum: ['error', 'warn', 'informational'], index: true },
  context: { type: Object, default: {} },
}, { timestamps: true, versionKey: false });

export default mongoose.model('GcpIssueLog', GcpIssueLogSchema);
