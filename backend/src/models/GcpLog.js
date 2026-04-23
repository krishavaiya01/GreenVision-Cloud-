import mongoose from 'mongoose';

const GcpLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  eventId: { type: String, required: true, unique: true, index: true },
  logName: { type: String, required: true, index: true },
  resource: { type: String, default: null },
  timestamp: { type: Date, required: true, index: true },
  severity: { type: String, index: true },
  message: { type: String, required: true },
  // Optional compact payload snapshot
  payload: { type: Object, default: {} },
}, { timestamps: true, versionKey: false });

export default mongoose.model('GcpLog', GcpLogSchema);
