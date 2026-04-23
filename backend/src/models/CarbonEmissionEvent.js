import mongoose from 'mongoose';

// Event-level carbon emission estimate derived from log ingestion windows.
// Granular events allow real-time aggregation and future monthly roll-ups.
const CarbonEmissionEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  provider: {
    type: String,
    enum: ['aws', 'azure', 'gcp'],
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['logs'],
    default: 'logs'
  },
  bytesIngested: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedKWh: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedCO2Kg: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedCost: {
    type: Number,
    required: true,
    min: 0
  },
  windowStart: {
    type: Date,
    required: true,
    index: true
  },
  windowEnd: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

CarbonEmissionEventSchema.index({ userId: 1, provider: 1, windowEnd: -1 });
CarbonEmissionEventSchema.index({ provider: 1, windowEnd: -1 });
CarbonEmissionEventSchema.index({ createdAt: -1 });

export default mongoose.model('CarbonEmissionEvent', CarbonEmissionEventSchema);
