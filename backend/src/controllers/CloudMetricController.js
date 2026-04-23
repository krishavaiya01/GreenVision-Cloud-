// src/controllers/CloudMetricController.js
import CloudMetrics from "../models/CloudMetrics.js"; // Fixed import name
import { emitToUser } from "../realtime/socket.js";
import Joi from "joi";
import mongoose from "mongoose";
import AWS from "aws-sdk";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

// Validation schema for cloud metrics
const cloudMetricSchema = Joi.object({
  provider: Joi.string().valid('aws', 'azure', 'gcp').default('aws'),
  metricName: Joi.string().optional(),
  value: Joi.number().optional(),
  timestamp: Joi.date().optional(),
  source: Joi.string().optional(),
  metrics: Joi.object({
    totalInstances: Joi.number().optional(),
    instances: Joi.array().optional(),
    summary: Joi.object({
      avgCPU: Joi.number().min(0).max(100).optional(),
      totalNetworkIn: Joi.number().min(0).optional(),
      totalNetworkOut: Joi.number().min(0).optional()
    }).optional()
  }).optional(),
  carbonFootprint: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional()
});

// Create new cloud metric
export const createCloudMetric = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = cloudMetricSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    // Create new cloud metric with user ID
    const cloudMetric = new CloudMetrics({
      userId: req.user.id, // Changed from 'user' to 'userId' to match schema
      provider: value.provider || 'aws',
      timestamp: value.timestamp || new Date(),
      metrics: value.metrics || {
        totalInstances: 0,
        instances: [],
        summary: {
          avgCPU: value.value || 0,
          totalNetworkIn: 0,
          totalNetworkOut: 0
        }
      },
      carbonFootprint: value.carbonFootprint || calculateCarbonFootprint(value.metrics || {}),
      cost: value.cost || estimateCost(value.metrics || {}),
      // Legacy fields for backward compatibility
      metricName: value.metricName,
      value: value.value,
      source: value.source
    });

    await cloudMetric.save();

    // Detect and broadcast cost anomalies in near real-time
    try {
      const anomaly = await evaluateCostSpike(cloudMetric);
      if (anomaly?.isAnomaly) {
        emitToUser(req.user.id, 'cloud:cost:anomaly', {
          ...anomaly,
          provider: cloudMetric.provider,
          metricId: cloudMetric._id,
          timestamp: cloudMetric.timestamp,
          userId: req.user.id
        });
      }
    } catch (e) {
      console.error('Anomaly detection failed:', e.message);
    }
    
    // Emit realtime update to user's room
    try {
      const latest = await CloudMetrics.getLatestMetrics(req.user.id, 1);
      emitToUser(req.user.id, 'cloud:metrics', {
        success: true,
        source: 'create',
        data: latest?.[0] || cloudMetric,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Realtime emit failed:', e.message);
    }

    res.status(201).json({
      success: true,
      data: cloudMetric,
      message: "Cloud metric created successfully",
      anomaly: undefined // reserved for future inline anomaly responses
    });

  } catch (err) {
    console.error('Create CloudMetric Error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// List cloud metrics with optional filters and pagination
export const getCloudMetrics = async (req, res) => {
  try {
    // Base query for user-specific data
    const query = { userId: req.user.id };

    // Apply filters
    if (req.query.provider) {
      query.provider = req.query.provider;
    }
    
    if (req.query.metricName) {
      query.metricName = req.query.metricName;
    }
    
    if (req.query.source) {
      query.source = req.query.source;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      query.timestamp = { 
        $gte: new Date(req.query.startDate), 
        $lte: new Date(req.query.endDate) 
      };
    } else if (req.query.startDate) {
      query.timestamp = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.timestamp = { $lte: new Date(req.query.endDate) };
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); // Max 100 items
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1); // Min page 1
    const skip = (page - 1) * limit;

    // Execute queries
    const [total, metrics] = await Promise.all([
      CloudMetrics.countDocuments(query),
      CloudMetrics.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      data: metrics,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      message: "Cloud metrics retrieved successfully"
    });

  } catch (err) {
    console.error('Get CloudMetrics Error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// Get single cloud metric by ID
export const getCloudMetricById = async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid metric ID format" 
      });
    }

    const metric = await CloudMetrics.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!metric) {
      return res.status(404).json({ 
        success: false,
        message: "Cloud metric not found" 
      });
    }

    res.json({
      success: true,
      data: metric,
      message: "Cloud metric retrieved successfully"
    });

  } catch (err) {
    console.error('Get CloudMetric By ID Error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// Update cloud metric
export const updateCloudMetric = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = cloudMetricSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid metric ID format" 
      });
    }

    // Update metric
    const updated = await CloudMetrics.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { 
        ...value,
        updatedAt: new Date()
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!updated) {
      return res.status(404).json({ 
        success: false,
        message: "Cloud metric not found" 
      });
    }

    res.json({
      success: true,
      data: updated,
      message: "Cloud metric updated successfully"
    });

  } catch (err) {
    console.error('Update CloudMetric Error:', err);
    res.status(400).json({ 
      success: false,
      message: "Update failed", 
      error: err.message 
    });
  }
};

// Delete cloud metric
export const deleteCloudMetric = async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid metric ID format" 
      });
    }

    const deleted = await CloudMetrics.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: "Cloud metric not found" 
      });
    }

    res.json({ 
      success: true,
      data: deleted,
      message: "Cloud metric deleted successfully" 
    });

  } catch (err) {
    console.error('Delete CloudMetric Error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// Get metrics summary with analytics
export const getMetricsSummary = async (req, res) => {
  try {
    // Build match query
    const match = { 
      userId: new mongoose.Types.ObjectId(req.user.id) 
    };

    // Optional filters
    if (req.query.provider) {
      match.provider = req.query.provider;
    }

    if (req.query.metricName) {
      match.metricName = req.query.metricName;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      match.timestamp = { 
        $gte: new Date(req.query.startDate), 
        $lte: new Date(req.query.endDate) 
      };
    }

    // Aggregation pipeline for comprehensive analytics
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalCost: { $sum: "$cost" },
          averageCost: { $avg: "$cost" },
          maxCost: { $max: "$cost" },
          minCost: { $min: "$cost" },
          totalEmissions: { $sum: "$carbonFootprint" },
          averageEmissions: { $avg: "$carbonFootprint" },
          maxEmissions: { $max: "$carbonFootprint" },
          minEmissions: { $min: "$carbonFootprint" },
          averageCPU: { $avg: "$metrics.summary.avgCPU" },
          maxCPU: { $max: "$metrics.summary.avgCPU" },
          minCPU: { $min: "$metrics.summary.avgCPU" },
          totalInstances: { $sum: "$metrics.totalInstances" },
          firstTimestamp: { $min: "$timestamp" },
          lastTimestamp: { $max: "$timestamp" }
        }
      },
      {
        $project: {
          _id: 0,
          summary: {
            totalRecords: "$totalRecords",
            dateRange: {
              start: "$firstTimestamp",
              end: "$lastTimestamp"
            }
          },
          costs: {
            total: { $round: ["$totalCost", 2] },
            average: { $round: ["$averageCost", 2] },
            max: { $round: ["$maxCost", 2] },
            min: { $round: ["$minCost", 2] }
          },
          emissions: {
            total: { $round: ["$totalEmissions", 2] },
            average: { $round: ["$averageEmissions", 2] },
            max: { $round: ["$maxEmissions", 2] },
            min: { $round: ["$minEmissions", 2] }
          },
          performance: {
            averageCPU: { $round: ["$averageCPU", 1] },
            maxCPU: { $round: ["$maxCPU", 1] },
            minCPU: { $round: ["$minCPU", 1] },
            totalInstances: "$totalInstances"
          }
        }
      }
    ];

    const result = await CloudMetrics.aggregate(pipeline);
    
    if (result.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: { totalRecords: 0 },
          costs: { total: 0, average: 0, max: 0, min: 0 },
          emissions: { total: 0, average: 0, max: 0, min: 0 },
          performance: { averageCPU: 0, maxCPU: 0, minCPU: 0, totalInstances: 0 }
        },
        message: "No metrics found for the specified criteria"
      });
    }

    // Calculate efficiency score
    const data = result[0];
    const efficiencyScore = calculateEfficiencyScore(
      data.performance.averageCPU || 0, 
      data.costs.total || 0
    );

    res.json({
      success: true,
      data: {
        ...data,
        efficiency: {
          score: efficiencyScore,
          rating: getEfficiencyRating(efficiencyScore)
        }
      },
      message: "Metrics summary retrieved successfully"
    });

  } catch (err) {
    console.error('Get Metrics Summary Error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// Cost and emission time series with anomaly flags
export const getCostSeries = async (req, res) => {
  try {
    const sinceHours = Math.max(1, parseInt(req.query.sinceHours, 10) || 24);
    const limitPoints = Math.min(Math.max(parseInt(req.query.limit, 10) || 300, 50), 1500);
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const docs = await CloudMetrics.find({
      userId: req.user.id,
      timestamp: { $gte: since },
    })
      .sort({ timestamp: 1 })
      .limit(limitPoints)
      .lean();

    const grouped = ['aws', 'azure', 'gcp'].map((provider) => ({ provider, series: [], anomalies: [] }));
    const idx = grouped.reduce((acc, p) => ({ ...acc, [p.provider]: p }), {});

    for (const doc of docs) {
      const bucket = idx[doc.provider] || idx.aws; // fallback guard
      bucket.series.push({
        t: doc.timestamp,
        cost: doc.cost || 0,
        carbonFootprint: doc.carbonFootprint || 0,
        region: doc.region,
        id: doc._id,
      });
    }

    // Detect anomalies per provider
    grouped.forEach((g) => {
      g.anomalies = findCostAnomalies(g.series);
    });

    res.json({
      success: true,
      data: {
        range: { from: since, to: new Date() },
        providers: grouped,
        totalPoints: docs.length,
      },
      message: 'Cost series retrieved',
    });
  } catch (err) {
    console.error('Get cost series error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch cost series', error: err.message });
  }
};

// Get all cloud provider data
export const getAllCloudProviderData = async (req, res) => {
  try {
    // Centralized fetch using server credentials only (no user secrets stored)
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || "us-east-1";
    let awsData = [];
    if (!awsAccessKeyId || !awsSecretAccessKey) {
      console.warn("Missing AWS env credentials – set AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY");
    } else {
      try {
        const ec2Client = new EC2Client({
          credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey },
          region: awsRegion
        });
        const command = new DescribeInstancesCommand({});
        const response = await ec2Client.send(command);
        awsData = response.Reservations || [];
      } catch (err) {
        console.error("Central AWS Fetch Error:", err.message);
      }
    }
    res.status(200).json({ success: true, data: { aws: awsData } });
  } catch (error) {
    console.error("Error fetching cloud provider data:", error.message);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Fetch latest normalized AWS instance list for the authenticated user
export const getAwsInstances = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, instanceType, region } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    // Find latest AWS metrics document for this user
    const latest = await CloudMetrics.findOne({ userId, provider: 'aws' })
      .sort({ timestamp: -1 })
      .lean();
    // Fallback: attempt global snapshot if user has none
    if (!latest) {
      return res.json({ success: true, data: { instances: [], totalInstances: 0 }, message: 'No AWS metrics ingested yet' });
    }

    let instances = (latest.metrics?.instances || []).map(inst => ({
      id: inst.instanceId || inst.id || 'unknown',
      instanceType: inst.instanceType || 't2.micro',
      avgCPU: inst.cpu && inst.cpu.length ?
        Math.round((inst.cpu.reduce((s, p) => s + (p.Average || 0), 0) / inst.cpu.length) * 10) / 10 : 0,
      networkIn: inst.networkIn && inst.networkIn.length ?
        Math.round(inst.networkIn.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      networkOut: inst.networkOut && inst.networkOut.length ?
        Math.round(inst.networkOut.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      diskRead: inst.diskRead && inst.diskRead.length ?
        Math.round(inst.diskRead.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      diskWrite: inst.diskWrite && inst.diskWrite.length ?
        Math.round(inst.diskWrite.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      sampleCount: inst.cpu ? inst.cpu.length : 0,
      region: latest.region || process.env.AWS_REGION || 'us-east-1'
    }));

    if (instanceType) {
      instances = instances.filter(i => i.instanceType === instanceType);
    }
    if (region) {
      instances = instances.filter(i => i.region === region);
    }

    const total = instances.length;
    const start = (pageNum - 1) * pageSize;
    const sliced = instances.slice(start, start + pageSize);

    res.json({
      success: true,
      data: {
        instances: sliced,
        totalInstances: total,
        page: pageNum,
        totalPages: Math.ceil(total / pageSize),
        limit: pageSize,
        capturedAt: latest.timestamp,
        efficiencyScore: latest.efficiencyScore || undefined
      },
      message: 'AWS instances retrieved'
    });
  } catch (err) {
    console.error('getAwsInstances error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch AWS instances', error: err.message });
  }
};

// Fetch latest normalized Azure instance list (Web Apps/VMs) for the authenticated user
export const getAzureInstances = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, instanceType, region } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    // Find latest Azure metrics document for this user
    const latest = await CloudMetrics.findOne({ userId, provider: 'azure' })
      .sort({ timestamp: -1 })
      .lean();
    if (!latest) {
      return res.json({ success: true, data: { instances: [], totalInstances: 0 }, message: 'No Azure metrics ingested yet' });
    }

    let instances = (latest.metrics?.instances || []).map(inst => ({
      id: inst.instanceId || inst.id || 'unknown',
      instanceType: inst.instanceType || 'standard',
      avgCPU: inst.cpu && inst.cpu.length ?
        Math.round((inst.cpu.reduce((s, p) => s + (p.Average || 0), 0) / inst.cpu.length) * 10) / 10 : 0,
      networkIn: inst.networkIn && inst.networkIn.length ?
        Math.round(inst.networkIn.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      networkOut: inst.networkOut && inst.networkOut.length ?
        Math.round(inst.networkOut.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      diskRead: inst.diskRead && inst.diskRead.length ?
        Math.round(inst.diskRead.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      diskWrite: inst.diskWrite && inst.diskWrite.length ?
        Math.round(inst.diskWrite.reduce((s, p) => s + (p.Average || 0), 0)) : 0,
      sampleCount: inst.cpu ? inst.cpu.length : 0,
      region: latest.region || 'eastus'
    }));

    if (instanceType) {
      instances = instances.filter(i => i.instanceType === instanceType);
    }
    if (region) {
      instances = instances.filter(i => i.region === region);
    }

    const total = instances.length;
    const start = (pageNum - 1) * pageSize;
    const sliced = instances.slice(start, start + pageSize);

    res.json({
      success: true,
      data: {
        instances: sliced,
        totalInstances: total,
        page: pageNum,
        totalPages: Math.ceil(total / pageSize),
        limit: pageSize,
        capturedAt: latest.timestamp,
        efficiencyScore: latest.efficiencyScore || undefined
      },
      message: 'Azure instances retrieved'
    });
  } catch (err) {
    console.error('getAzureInstances error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Azure instances', error: err.message });
  }
};

// Helper functions
async function evaluateCostSpike(metricDoc) {
  const recent = await CloudMetrics.find({ userId: metricDoc.userId, provider: metricDoc.provider })
    .sort({ timestamp: -1 })
    .limit(40)
    .lean();
  return detectCostSpike(recent);
}

function findCostAnomalies(series = []) {
  if (!Array.isArray(series) || series.length < 6) return [];
  const anomalies = [];
  const lookback = 12;
  for (let i = 0; i < series.length; i++) {
    const windowStart = Math.max(0, i - lookback);
    const window = series.slice(windowStart, i);
    if (window.length < 5) continue;
    const baseline = median(window.map((p) => p.cost || 0));
    const mad = medianAbsoluteDeviation(window.map((p) => p.cost || 0), baseline);
    const threshold = baseline + Math.max(mad * 3, baseline * 0.6, 5);
    const current = series[i];
    const isGPUInstance = Boolean(current?.region && /gpu|g[0-9]/i.test(current.region)) || false;
    if ((current.cost || 0) > threshold) {
      const severity = Math.min(100, Math.round(((current.cost - threshold) / (threshold || 1)) * 100));
      anomalies.push({
        ...current,
        baseline,
        threshold,
        severity,
        reason: isGPUInstance ? 'gpu_instance_spend' : 'cost_spike',
      });
    }
  }
  return anomalies;
}

function detectCostSpike(recentDocs = []) {
  if (!recentDocs.length) return null;
  const sorted = [...recentDocs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latest = sorted[0];
  const rest = sorted.slice(1);
  if (rest.length < 5) return null;

  const costs = rest.map((d) => d.cost || 0).filter((n) => Number.isFinite(n));
  if (!costs.length) return null;
  const baseline = median(costs);
  const mad = medianAbsoluteDeviation(costs, baseline);
  const threshold = baseline + Math.max(mad * 3, baseline * 0.6, 5);
  const latestCost = latest.cost || 0;
  const isGPUInstance = Boolean(latest.metrics?.instances?.some((inst) => /g[0-9]|p[0-9]|gpu/i.test(inst.instanceType || '')));
  const ratio = baseline ? latestCost / baseline : 0;

  if (latestCost > threshold) {
    return {
      isAnomaly: true,
      latestCost,
      baseline,
      threshold,
      ratio,
      severity: Math.min(100, Math.round(((latestCost - threshold) / (threshold || 1)) * 100)),
      reason: isGPUInstance ? 'gpu_instance_spend' : 'cost_spike',
    };
  }
  return null;
}

function median(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianAbsoluteDeviation(values = [], med = null) {
  if (!values.length) return 0;
  const m = med ?? median(values);
  const deviations = values.map((v) => Math.abs(v - m));
  return median(deviations);
}

function calculateCarbonFootprint(metrics) {
  if (!metrics || typeof metrics !== 'object') return 0;
  const carbonIntensity = 0.45; // kg CO2/kWh for US-East
  const avgCPU = metrics.summary && typeof metrics.summary.avgCPU === 'number' ? metrics.summary.avgCPU : 0;
  const instanceCount = typeof metrics.totalInstances === 'number' ? metrics.totalInstances : 1;
  const estimatedkWh = (avgCPU / 100) * instanceCount * 0.1;
  return Math.round(estimatedkWh * carbonIntensity * 100) / 100;
}

function estimateCost(metrics) {
  if (!metrics || typeof metrics !== 'object') return 0;
  const baseInstanceCost = 0.1; // $0.1 per hour per instance
  const avgCPU = metrics.summary && typeof metrics.summary.avgCPU === 'number' ? metrics.summary.avgCPU : 0;
  const instanceCount = typeof metrics.totalInstances === 'number' ? metrics.totalInstances : 1;
  const networkIn = metrics.summary && typeof metrics.summary.totalNetworkIn === 'number' ? metrics.summary.totalNetworkIn : 0;
  const networkOut = metrics.summary && typeof metrics.summary.totalNetworkOut === 'number' ? metrics.summary.totalNetworkOut : 0;
  const networkCost = (networkIn + networkOut) * 0.00000001;
  
  const totalCost = (instanceCount * baseInstanceCost * (avgCPU / 100)) + networkCost;
  return Math.round(totalCost * 100) / 100;
}

function calculateEfficiencyScore(avgCPU, totalCost) {
  const cpuEfficiency = avgCPU > 80 ? 50 : avgCPU < 20 ? 60 : 100;
  const costEfficiency = totalCost < 100 ? 100 : totalCost < 500 ? 80 : 60;
  return Math.round((cpuEfficiency + costEfficiency) / 2);
}

function getEfficiencyRating(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Poor';
  return 'Critical';
}
