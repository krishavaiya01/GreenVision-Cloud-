// src/models/AITrainingData.js
import mongoose from 'mongoose';

const AITrainingDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  usageMetrics: {
    cpuUtilization: { type: Number, required: true },
    memoryUsage: { type: Number, default: 0 },
    storageUsage: { type: Number, default: 0 },
    networkTraffic: { type: Number, required: true }
  },
  carbonEmissions: { type: Number, required: true },
  costData: { type: Number, required: true },
  optimizationApplied: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model('AITrainingData', AITrainingDataSchema);
