import mongoose from 'mongoose';

const EmailDeliveryLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  type: { type: String, enum: ['daily','weekly'], required: true },
  status: { type: String, enum: ['sent','failed'], required: true },
  attempts: { type: Number, default: 1 },
  error: { type: String },
  meta: { type: Object, default: {} }, // totals, costs, counts, etc.
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

EmailDeliveryLogSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model('EmailDeliveryLog', EmailDeliveryLogSchema);
