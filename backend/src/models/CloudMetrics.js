// src/models/CloudMetrics.js
import mongoose from 'mongoose';

const CloudMetricsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  provider: { 
    type: String, 
    enum: ['aws', 'azure', 'gcp'], 
    required: true,
    default: 'aws'
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  // Main metrics structure
  metrics: {
    totalInstances: {
      type: Number,
      default: 0,
      min: 0
    },
    instances: [{
      instanceId: {
        type: String,
        default: 'i-default'
      },
      instanceType: {
        type: String,
        default: 't2.micro'
      },
      cpu: [{
        Timestamp: {
          type: Date,
          default: Date.now
        },
        Average: {
          type: Number,
          default: 0,
          min: 0,
          max: 100
        }
      }],
      networkIn: [{
        Timestamp: {
          type: Date,
          default: Date.now
        },
        Average: {
          type: Number,
          default: 0,
          min: 0
        }
      }],
      networkOut: [{
        Timestamp: {
          type: Date,
          default: Date.now
        },
        Average: {
          type: Number,
          default: 0,
          min: 0
        }
      }],
      diskRead: [{
        Timestamp: {
          type: Date,
          default: Date.now
        },
        Average: {
          type: Number,
          default: 0,
          min: 0
        }
      }],
      diskWrite: [{
        Timestamp: {
          type: Date,
          default: Date.now
        },
        Average: {
          type: Number,
          default: 0,
          min: 0
        }
      }]
    }],
    summary: {
      avgCPU: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      maxCPU: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      minCPU: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      totalNetworkIn: {
        type: Number,
        default: 0,
        min: 0
      },
      totalNetworkOut: {
        type: Number,
        default: 0,
        min: 0
      },
      totalDiskRead: {
        type: Number,
        default: 0,
        min: 0
      },
      totalDiskWrite: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },
  
  // Environmental and cost tracking
  carbonFootprint: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  cost: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'JPY']
  },
  
  // Additional metadata
  region: {
    type: String,
    default: 'us-east-1'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOptimized: {
    type: Boolean,
    default: false
  },
  dataSource: {
    type: String,
    enum: ['cloudwatch', 'azure-monitor', 'gcp-monitoring', 'manual'],
    default: 'cloudwatch'
  },
  
  // Legacy fields for backward compatibility
  metricName: {
    type: String,
    trim: true
  },
  value: {
    type: Number,
    min: 0
  },
  source: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better performance
CloudMetricsSchema.index({ userId: 1, timestamp: -1 });
CloudMetricsSchema.index({ provider: 1, timestamp: -1 });
CloudMetricsSchema.index({ userId: 1, provider: 1 });
CloudMetricsSchema.index({ carbonFootprint: -1 });
CloudMetricsSchema.index({ cost: -1 });

// Virtual properties
CloudMetricsSchema.virtual('efficiencyScore').get(function() {
  const avgCPU = this.metrics?.summary?.avgCPU || 0;
  const cost = this.cost || 0;
  
  const cpuEfficiency = avgCPU > 80 ? 50 : avgCPU < 20 ? 60 : 100;
  const costEfficiency = cost < 100 ? 100 : cost < 500 ? 80 : 60;
  
  return Math.round((cpuEfficiency + costEfficiency) / 2);
});

CloudMetricsSchema.virtual('totalNetworkTraffic').get(function() {
  const networkIn = this.metrics?.summary?.totalNetworkIn || 0;
  const networkOut = this.metrics?.summary?.totalNetworkOut || 0;
  return networkIn + networkOut;
});

CloudMetricsSchema.virtual('costPerInstance').get(function() {
  const instances = this.metrics?.totalInstances || 1;
  return Math.round((this.cost / instances) * 100) / 100;
});

// Instance methods
CloudMetricsSchema.methods.calculateEfficiencyScore = function() {
  const avgCPU = this.metrics?.summary?.avgCPU || 0;
  const cost = this.cost || 0;
  
  const cpuEfficiency = avgCPU > 80 ? 50 : avgCPU < 20 ? 60 : 100;
  const costEfficiency = cost < 100 ? 100 : cost < 500 ? 80 : 60;
  
  return Math.round((cpuEfficiency + costEfficiency) / 2);
};

CloudMetricsSchema.methods.toSummary = function() {
  return {
    id: this._id,
    userId: this.userId,
    provider: this.provider,
    region: this.region,
    timestamp: this.timestamp,
    totalInstances: this.metrics?.totalInstances || 0,
    avgCPU: this.metrics?.summary?.avgCPU || 0,
    totalNetworkTraffic: this.totalNetworkTraffic,
    carbonFootprint: this.carbonFootprint,
    cost: this.cost,
    efficiencyScore: this.efficiencyScore,
    currency: this.currency,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

CloudMetricsSchema.methods.updateSummary = function() {
  if (this.metrics && this.metrics.instances) {
    let totalCPU = 0;
    let totalNetworkIn = 0;
    let totalNetworkOut = 0;
    let totalDiskRead = 0;
    let totalDiskWrite = 0;
    let cpuDataPoints = 0;
    let maxCPU = 0;
    let minCPU = 100;

    this.metrics.instances.forEach(instance => {
      // Calculate CPU metrics
      if (instance.cpu && instance.cpu.length > 0) {
        const avgInstanceCPU = instance.cpu.reduce((sum, point) => sum + point.Average, 0) / instance.cpu.length;
        totalCPU += avgInstanceCPU;
        cpuDataPoints++;
        maxCPU = Math.max(maxCPU, Math.max(...instance.cpu.map(p => p.Average)));
        minCPU = Math.min(minCPU, Math.min(...instance.cpu.map(p => p.Average)));
      }
      
      // Calculate network metrics
      if (instance.networkIn && instance.networkIn.length > 0) {
        totalNetworkIn += instance.networkIn.reduce((sum, point) => sum + point.Average, 0);
      }
      if (instance.networkOut && instance.networkOut.length > 0) {
        totalNetworkOut += instance.networkOut.reduce((sum, point) => sum + point.Average, 0);
      }
      
      // Calculate disk metrics
      if (instance.diskRead && instance.diskRead.length > 0) {
        totalDiskRead += instance.diskRead.reduce((sum, point) => sum + point.Average, 0);
      }
      if (instance.diskWrite && instance.diskWrite.length > 0) {
        totalDiskWrite += instance.diskWrite.reduce((sum, point) => sum + point.Average, 0);
      }
    });

    // Update summary
    this.metrics.summary.avgCPU = cpuDataPoints > 0 ? Math.round((totalCPU / cpuDataPoints) * 10) / 10 : 0;
    this.metrics.summary.maxCPU = maxCPU === 0 ? 0 : maxCPU;
    this.metrics.summary.minCPU = minCPU === 100 ? 0 : minCPU;
    this.metrics.summary.totalNetworkIn = Math.round(totalNetworkIn);
    this.metrics.summary.totalNetworkOut = Math.round(totalNetworkOut);
    this.metrics.summary.totalDiskRead = Math.round(totalDiskRead);
    this.metrics.summary.totalDiskWrite = Math.round(totalDiskWrite);
  }
  return this;
};

// Static methods
CloudMetricsSchema.statics.getLatestMetrics = function(userId, limit = 10) {
  return this.find({ userId, isActive: true })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

CloudMetricsSchema.statics.getMetricsByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    timestamp: { $gte: startDate, $lte: endDate },
    isActive: true
  }).sort({ timestamp: 1 });
};

CloudMetricsSchema.statics.getProviderSummary = function(userId, provider) {
  return this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId), 
        provider, 
        isActive: true 
      } 
    },
    {
      $group: {
        _id: '$provider',
        totalCost: { $sum: '$cost' },
        avgCost: { $avg: '$cost' },
        totalEmissions: { $sum: '$carbonFootprint' },
        avgEmissions: { $avg: '$carbonFootprint' },
        avgCPU: { $avg: '$metrics.summary.avgCPU' },
        totalInstances: { $sum: '$metrics.totalInstances' },
        count: { $sum: 1 },
        firstMetric: { $min: '$timestamp' },
        lastMetric: { $max: '$timestamp' }
      }
    }
  ]);
};

CloudMetricsSchema.statics.getUserSummary = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalCost: { $sum: '$cost' },
        totalEmissions: { $sum: '$carbonFootprint' },
        avgCost: { $avg: '$cost' },
        avgEmissions: { $avg: '$carbonFootprint' },
        avgCPU: { $avg: '$metrics.summary.avgCPU' },
        maxCost: { $max: '$cost' },
        minCost: { $min: '$cost' },
        totalInstances: { $sum: '$metrics.totalInstances' },
        providers: { $addToSet: '$provider' }
      }
    }
  ]);
};

// Pre-save middleware
CloudMetricsSchema.pre('save', function(next) {
  // Auto-update summary before saving
  this.updateSummary();
  
  // Auto-calculate carbon footprint if not provided
  if (this.carbonFootprint === 0 && this.metrics?.summary?.avgCPU) {
    const carbonIntensity = 0.45; // kg CO2/kWh for US-East
    const avgCPU = this.metrics.summary.avgCPU || 0;
    const instanceCount = this.metrics.totalInstances || 1;
    const estimatedkWh = (avgCPU / 100) * instanceCount * 0.1;
    this.carbonFootprint = Math.round(estimatedkWh * carbonIntensity * 100) / 100;
  }
  
  // Auto-calculate cost if not provided
  if (this.cost === 0 && this.metrics?.summary?.avgCPU) {
    const baseInstanceCost = 0.1; // $0.1 per hour per instance
    const avgCPU = this.metrics.summary.avgCPU || 0;
    const instanceCount = this.metrics.totalInstances || 1;
    const networkCost = ((this.metrics.summary.totalNetworkIn || 0) + 
                        (this.metrics.summary.totalNetworkOut || 0)) * 0.00000001;
    
    this.cost = Math.round(((instanceCount * baseInstanceCost * (avgCPU / 100)) + networkCost) * 100) / 100;
  }
  
  next();
});

// Post-save middleware
CloudMetricsSchema.post('save', function(doc) {
  console.log(`✅ CloudMetric saved: ${doc._id} for user ${doc.userId} (${doc.provider})`);
});

// JSON transformation
CloudMetricsSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});

// Export the model
export default mongoose.model('CloudMetrics', CloudMetricsSchema);
