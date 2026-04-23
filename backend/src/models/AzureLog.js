import mongoose from 'mongoose';

const AzureLogSchema = new mongoose.Schema({
  time: { type: Date, index: true },
  level: { type: String, index: true },
  category: { type: String, index: true },
  operation: { type: String },
  message: { type: String },
  resourceId: { type: String, index: true },
  provider: { type: String, default: 'azure', index: true },
}, { timestamps: true, versionKey: false });

// Prevent duplicates when the same window is fetched multiple times
AzureLogSchema.index({ time: 1, resourceId: 1, operation: 1, message: 1 }, { unique: true, sparse: true });

// Optional TTL based on env (e.g., AZURE_LOG_TTL_DAYS)
const ttlDays = parseInt(process.env.AZURE_LOG_TTL_DAYS || '0', 10);
if (ttlDays > 0) {
  AzureLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
}

export default mongoose.model('AzureLog', AzureLogSchema);
