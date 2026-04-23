// src/models/AnomalyAlert.js
import mongoose from 'mongoose';

const AnomalyAlertSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Anomaly type
  anomalyType: {
    type: String,
    enum: ['cost_spike', 'cpu_spike', 'memory_spike', 'storage_spike', 'network_spike', 'emissions_spike'],
    required: true,
    index: true
  },
  
  // Cloud provider
  provider: {
    type: String,
    enum: ['aws', 'azure', 'gcp'],
    default: 'aws',
    index: true
  },
  
  // Resource details
  resourceId: {
    type: String,
    default: null
  },
  resourceType: {
    type: String,
    enum: ['instance', 'storage', 'network', 'database', 'general'],
    default: 'general'
  },
  
  // Anomaly metrics
  metricName: {
    type: String,
    required: true
  },
  normalValue: {
    type: Number,
    required: true
  },
  anomalousValue: {
    type: Number,
    required: true
  },
  threshold: {
    type: Number,
    required: true
  },
  percentageIncrease: {
    type: Number,
    required: true
  },
  zScore: {
    type: Number,
    default: 0
  },
  
  // Detection info
  detectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active',
    index: true
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  acknowledgedBy: {
    type: String,
    default: null
  },
  
  // Description and recommendation
  description: {
    type: String,
    required: true
  },
  recommendation: {
    type: String,
    default: null
  },
  
  // Severity level
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Cost impact
  estimatedCostImpact: {
    type: Number,
    default: 0
  },
  
  // Carbon impact
  estimatedCarbonImpact: {
    type: Number,
    default: 0
  },
  
  // Historical data for comparison
  historicalAverage: {
    type: Number,
    default: null
  },
  historicalStdDev: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Index for quick queries
AnomalyAlertSchema.index({ userId: 1, status: 1, detectedAt: -1 });
AnomalyAlertSchema.index({ userId: 1, anomalyType: 1, detectedAt: -1 });
AnomalyAlertSchema.index({ provider: 1, detectedAt: -1 });

export default mongoose.model('AnomalyAlert', AnomalyAlertSchema);
