// src/routes/cloud.js

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getUserCarbonFootprint, getUserCarbonTrends } from '../controllers/CarbonFootprintController.js';
import carbonEmissionService from '../services/carbon-emission-service.js';
import { getAllCloudProviderData, getAwsInstances, getAzureInstances } from '../controllers/CloudMetricController.js';
import AwsIssueLog from '../models/AwsIssueLog.js';
import AzureIssueLog from '../models/AzureIssueLog.js';
import GcpIssueLog from '../models/GcpIssueLog.js';
import GcpLog from '../models/GcpLog.js';
import GcpRawLog from '../models/GcpRawLog.js';
import { diagAzureLogsWindow, getAzureLogsSummary } from '../services/azure-logs-service.js';
import azureResourceService from '../services/azure-resource-service.js';
import mongoose from 'mongoose';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import gcpResourceService from '../services/gcp-resource-service.js';

const router = express.Router();

// Apply authentication to all cloud routes
router.use(protect());

// GET /api/cloud/aws/metrics - Live AWS Metrics
router.get('/aws/metrics', async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    const userId = req.user.id;
    
    console.log('☁️ Fetching AWS metrics for user:', userId);
    
    // Mock AWS CloudWatch data (replace with real AWS SDK calls)
    const mockMetrics = {
      totalInstances: 2,
      instances: [{
        instanceId: 'i-1234567890abcdef0',
        instanceType: 't3.medium',
        region: 'us-east-1',
        cpu: [
          { Timestamp: new Date(), Average: 45.2 },
          { Timestamp: new Date(Date.now() - 300000), Average: 50.1 }
        ],
        networkIn: [
          { Timestamp: new Date(), Average: 1024 }
        ],
        networkOut: [
          { Timestamp: new Date(), Average: 2048 }
        ]
      }],
      summary: {
        avgCPU: 47.6,
        totalNetworkIn: 1024,
        totalNetworkOut: 2048
      }
    };
    
    const carbonFootprint = (mockMetrics.summary.avgCPU / 100) * 0.45; // kg CO2
    const cost = mockMetrics.totalInstances * 0.1; // $0.1 per hour per instance
    
    res.json({
      success: true,
      data: {
        metrics: mockMetrics,
        carbonFootprint: Math.round(carbonFootprint * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        userId: userId,
        timeRange: timeRange
      },
      message: 'AWS metrics retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ CloudWatch API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AWS metrics',
      message: error.message
    });
  }
});

// GET /api/cloud/aws/instances - Latest ingested AWS instances snapshot
router.get('/aws/instances', async (req, res) => {
  return getAwsInstances(req, res);
});

// GET /api/cloud/azure/instances - Latest ingested Azure instances snapshot
router.get('/azure/instances', async (req, res) => {
  return getAzureInstances(req, res);
});

// GET /api/cloud/gcp/resources - GCP resource inventory (Compute, GKE, Storage, Pub/Sub)
router.get('/gcp/resources', async (req, res) => {
  try {
    const data = await gcpResourceService.getInventory();
    const projectId = (() => { try { return gcpResourceService.getProjectId(); } catch { return null; } })();
    res.json({ success: true, data: { projectId, ...data } });
  } catch (e) {
    console.error('❌ Get GCP resources error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch GCP resources', error: e.message });
  }
});

// GET /api/cloud/aws/logs/issues?level=error|warn&sinceMinutes=60&limit=200&logGroup=/aws/lambda/foo
router.get('/aws/logs/issues', async (req, res) => {
  try {
    const { level, sinceMinutes = 60, limit = 200, logGroup } = req.query;
    const sinceMs = Math.max(1, parseInt(sinceMinutes, 10) || 60) * 60 * 1000;
    const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));

    const q = {
      timestamp: { $gte: new Date(Date.now() - sinceMs) }
    };
    if (level && ['error', 'warn'].includes(String(level))) q.level = level;
    if (logGroup) q.logGroup = String(logGroup);

    // Multi-tenant guard: try to filter by userId if logs are associated; include null for global logs
    try {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      q.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) {
      q.userId = null;
    }

    const data = await AwsIssueLog.find(q)
      .sort({ timestamp: -1 })
      .limit(lim)
      .lean();

    res.json({ success: true, data });
  } catch (e) {
    console.error('❌ Get AWS issue logs error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch AWS issue logs', error: e.message });
  }
});

// GET /api/cloud/azure/logs/issues?level=error|warn&sinceMinutes=60&limit=200&logGroup=AzureActivity
router.get('/azure/logs/issues', async (req, res) => {
  try {
    const { level, sinceMinutes = 60, limit = 200, logGroup } = req.query;
    const sinceMs = Math.max(1, parseInt(sinceMinutes, 10) || 60) * 60 * 1000;
    const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));

    const q = { timestamp: { $gte: new Date(Date.now() - sinceMs) } };
    if (level && ['error', 'warn'].includes(String(level))) q.level = level;
    if (logGroup) q.logGroup = String(logGroup);
    try {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      q.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) { q.userId = null; }

    const data = await AzureIssueLog.find(q).sort({ timestamp: -1 }).limit(lim).lean();
    res.json({ success: true, data });
  } catch (e) {
    console.error('❌ Get Azure issue logs error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Azure issue logs', error: e.message });
  }
});

// GET /api/cloud/azure/logs/diag - check if KQL returns anything recently
router.get('/azure/logs/diag', diagAzureLogsWindow);

// GET /api/cloud/azure/logs/summary?sinceMinutes=180
router.get('/azure/logs/summary', async (req, res) => {
  try {
    const { sinceMinutes = 180 } = req.query;
    const data = await getAzureLogsSummary({ sinceMinutes });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch Azure logs summary', error: e.message });
  }
});

// GET /api/cloud/azure/resources - list Azure resource groups and web apps
router.get('/azure/resources', async (req, res) => {
  try {
    const data = await azureResourceService.getInventory();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch Azure resources', error: e.message });
  }
});

// GET /api/cloud/logs/issues?provider=aws|azure|gcp|all&level=error|warn&sinceMinutes=60&limit=200
router.get('/logs/issues', async (req, res) => {
  try {
    const { provider = 'all', level, sinceMinutes = 60, limit = 200, logGroup } = req.query;
    const sinceMs = Math.max(1, parseInt(sinceMinutes, 10) || 60) * 60 * 1000;
    const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));

    const baseQuery = { timestamp: { $gte: new Date(Date.now() - sinceMs) } };
    if (level && ['error', 'warn'].includes(String(level))) baseQuery.level = level;
    if (logGroup) baseQuery.logGroup = String(logGroup);
    // Multi-tenant filter
    try {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      baseQuery.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) {
      baseQuery.userId = null;
    }

    let results = [];
    if (provider === 'aws' || provider === 'all') {
      const aws = await AwsIssueLog.find(baseQuery).sort({ timestamp: -1 }).limit(lim).lean();
      results = results.concat(aws.map(r => ({ ...r, provider: 'aws' })));
    }
    if (provider === 'azure' || provider === 'all') {
      const az = await AzureIssueLog.find(baseQuery).sort({ timestamp: -1 }).limit(lim).lean();
      results = results.concat(az.map(r => ({ ...r, provider: 'azure' })));
    }

    // Sort combined and clamp to limit
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    results = results.slice(0, lim);

    res.json({ success: true, data: results });
  } catch (e) {
    console.error('❌ Get multi-provider issue logs error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch issue logs', error: e.message });
  }
});

// GET /api/cloud/aws/logs/diag - quick diagnostic for CloudWatch Logs ingestion
router.get('/aws/logs/diag', async (req, res) => {
  try {
    const groups = (process.env.AWS_LOG_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);
    const region = process.env.AWS_REGION || 'us-east-1';
    const haveCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    if (!groups.length) return res.status(400).json({ success: false, message: 'AWS_LOG_GROUPS not set' });

    const client = new CloudWatchLogsClient({
      region,
      credentials: haveCreds ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } : undefined,
    });
    const endTime = Date.now();
    const startTime = endTime - 2 * 60 * 1000; // last 2 minutes
    const results = [];
    for (const logGroupName of groups) {
      let nextToken = undefined;
      let count = 0;
      try {
        do {
          const cmd = new FilterLogEventsCommand({ logGroupName, startTime, endTime, nextToken, limit: 10000 });
          const out = await client.send(cmd);
          count += (out.events || []).length;
          nextToken = out.nextToken;
        } while (nextToken);
        results.push({ logGroupName, events: count });
      } catch (e) {
        results.push({ logGroupName, error: e.message });
      }
    }
    res.json({ success: true, data: { region, groups, haveCreds, window: { start: new Date(startTime), end: new Date(endTime) }, results } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Diag failed', error: e.message });
  }
});

// GET /api/cloud/dashboard - Complete Dashboard Data
import CarbonFootprint from '../models/CarbonFootprint.js';
import CloudMetrics from '../models/CloudMetrics.js';
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    // Try primary carbon footprint source
    let latestCarbon = await CarbonFootprint.findOne({ userId }).sort({ createdAt: -1 });
    let carbonTrends = await CarbonFootprint.find({ userId }).sort({ createdAt: -1 }).limit(6);

    // Fallback: derive synthetic carbon summary from latest CloudMetrics if missing
    if (!latestCarbon) {
      const latestMetric = await CloudMetrics.findOne({ userId, provider: 'aws' }).sort({ timestamp: -1 });
      if (latestMetric) {
        const monthKey = new Date().toISOString().slice(0,7);
        latestCarbon = {
          totalCost: latestMetric.cost || 0,
            totalEmissions: latestMetric.carbonFootprint || 0,
            avgCPUUsage: latestMetric.metrics?.summary?.avgCPU || 0,
            activeInstances: latestMetric.metrics?.totalInstances || 0,
            efficiencyScore: latestMetric.efficiencyScore || 0,
            month: monthKey
        };
        carbonTrends = [{ month: monthKey, totalCost: latestCarbon.totalCost, totalEmissions: latestCarbon.totalEmissions }];
      }
    }

    // Per-provider carbon/cost totals in recent window (last 24h) for dashboard chips
    const since = new Date(Date.now() - 24*60*60*1000);
    let provAgg = await (await import('../models/CarbonEmissionEvent.js')).default.aggregate([
      { $match: { windowEnd: { $gte: since }, $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }] } },
      { $group: { _id: '$provider', kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
      { $project: { _id: 0, provider: '$_id', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } }
    ]);
  const wantProv = ['aws', 'azure', 'gcp'];
    const haveProv = new Set(provAgg.map(p=>p.provider));
    for (const prov of wantProv) {
      if (!haveProv.has(prov)) provAgg.push({ provider: prov, kgCO2: 0, cost: 0 });
    }

    const overview = latestCarbon ? {
      totalCost: latestCarbon.totalCost || 0,
      totalEmissions: latestCarbon.totalEmissions || 0,
      avgCPUUsage: latestCarbon.avgCPUUsage || 0,
      activeInstances: latestCarbon.activeInstances || 0,
      efficiencyScore: latestCarbon.efficiencyScore || 0,
      providers: provAgg // [{provider:'aws',kgCO2,cost}, {provider:'azure',...}]
    } : { totalCost: 0, totalEmissions: 0, avgCPUUsage: 0, activeInstances: 0, efficiencyScore: 0, providers: [] };

    const trends = {
      costs: (carbonTrends || []).map(r => ({ date: r.month, value: r.totalCost })),
      emissions: (carbonTrends || []).map(r => ({ date: r.month, value: r.totalEmissions }))
    };

    res.json({
      success: true,
      data: {
        overview,
        trends,
        userId,
        lastUpdated: new Date().toISOString()
      },
      message: 'Dashboard data retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Dashboard API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});
// GET /api/cloud/carbon - Get latest carbon footprint for user
router.get('/carbon', getUserCarbonFootprint);

// GET /api/cloud/carbon/trends - Get carbon footprint trends for user
router.get('/carbon/trends', getUserCarbonTrends);

// GET /api/cloud/carbon/realtime?sinceMinutes=60 - Real-time multi-provider carbon aggregation from emission events
router.get('/carbon/realtime', async (req, res) => {
  try {
    const { sinceMinutes = 60 } = req.query;
    const data = await carbonEmissionService.getRealtimeEmissions({ userId: req.user.id, sinceMinutes });
    res.json({ success: true, data });
  } catch (e) {
    console.error('❌ Realtime carbon error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch realtime carbon data', error: e.message });
  }
});

// GET /api/cloud/providers - Get data for all connected cloud providers
router.get('/providers', getAllCloudProviderData);

// GET /api/cloud/gcp/logs/issues?level=error|warn&sinceMinutes=60&limit=200&logName=projects/..../logs/...
router.get('/gcp/logs/issues', async (req, res) => {
  try {
    const { level, sinceMinutes = 60, limit = 200, logName } = req.query;
    const sinceMs = Math.max(1, parseInt(sinceMinutes, 10) || 60) * 60 * 1000;
    const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));
    const q = { timestamp: { $gte: new Date(Date.now() - sinceMs) } };
    if (level && ['error','warn'].includes(String(level))) q.level = level;
    if (logName) q.logName = String(logName);
    try {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      q.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) {
      q.userId = null;
    }
    const data = await GcpIssueLog.find(q).sort({ timestamp: -1 }).limit(lim).lean();
    res.json({ success: true, data });
  } catch (e) {
    console.error('❌ Get GCP issue logs error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch GCP issue logs', error: e.message });
  }
});

// GET /api/cloud/gcp/logs?sinceMinutes=60&limit=200&logName=...&severity=INFO|ERROR|WARNING
router.get('/gcp/logs', async (req, res) => {
  try {
    const { sinceMinutes = 60, limit = 200, logName, severity } = req.query;
    const sinceMs = Math.max(1, parseInt(sinceMinutes, 10) || 60) * 60 * 1000;
    const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));
    const q = { timestamp: { $gte: new Date(Date.now() - sinceMs) } };
    if (logName) q.logName = String(logName);
    if (severity) q.severity = String(severity);
    try {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      q.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) {
      q.userId = null;
    }
    const data = await GcpLog.find(q).sort({ timestamp: -1 }).limit(lim).lean();
    res.json({ success: true, data });
  } catch (e) {
    console.error('❌ Get GCP logs error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to fetch GCP logs', error: e.message });
  }
});

// GET /api/cloud/gcp/logs/diag - quick diagnostics for GCP logs ingestion
router.get('/gcp/logs/diag', async (req, res) => {
  try {
    const now = Date.now();
    const WINDOW_MS = parseInt(process.env.GCP_LOGS_WINDOW_MS || '60000', 10);
    const currentWindowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const lastWindowStart = new Date(currentWindowStart - WINDOW_MS);
    const since5m = new Date(now - 5 * 60 * 1000);
    const [rawCount, issues5, logs5] = await Promise.all([
      GcpRawLog.countDocuments({ windowStart: lastWindowStart }),
      GcpIssueLog.countDocuments({ timestamp: { $gte: since5m } }),
      GcpLog.countDocuments({ timestamp: { $gte: since5m } }),
    ]);
    const subscription = (process.env.GCP_LOGS_SUBSCRIPTION || '').trim();
    const topic = (process.env.GCP_LOGS_TOPIC || '').trim();
    let projectId = null;
    try { projectId = (await import('../services/gcp-resource-service.js')).default.getProjectId(); } catch {}
    res.json({
      success: true,
      data: {
        now: new Date(now),
        windowMs: WINDOW_MS,
        lastWindowStart,
        rawCount,
        issuesLast5m: issues5,
        logsLast5m: logs5,
        env: { subscription, topic, projectId, debug: String(process.env.GCP_LOGS_DEBUG || '') },
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'GCP logs diag failed', error: e.message });
  }
});

export default router;
