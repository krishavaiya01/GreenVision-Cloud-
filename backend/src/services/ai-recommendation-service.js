// src/services/ai-recommendation-service.js
import AITrainingData from '../models/AITrainingData.js';
import AwsIssueLog from '../models/AwsIssueLog.js';
import CloudMetrics from '../models/CloudMetrics.js';
import AnomalyAlert from '../models/AnomalyAlert.js';
import mongoose from 'mongoose';
import fs from 'fs';

// Simplified per-month pricing catalogs to estimate rightsizing savings
const RIGHTSIZING_PRICING = {
  aws: {
    't3.micro': 8,
    't3.small': 16,
    't3.medium': 32,
    't3.large': 65,
    't3.xlarge': 130,
    'm5.large': 80,
    'm5.xlarge': 160,
    'c5.large': 70,
    'c5.xlarge': 140
  },
  azure: {
    'B1s': 5,
    'B2s': 15,
    'B2ms': 30,
    'D2s_v3': 70,
    'D4s_v3': 140,
    'D8s_v3': 280
  },
  gcp: {
    'e2-micro': 5,
    'e2-small': 10,
    'e2-medium': 20,
    'e2-standard-2': 60,
    'e2-standard-4': 120,
    'n2-standard-2': 90,
    'n2-standard-4': 180
  }
};

const RIGHTSIZING_ORDER = {
  aws: ['t3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 'm5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge'],
  azure: ['B1s', 'B2s', 'B2ms', 'D2s_v3', 'D4s_v3', 'D8s_v3'],
  gcp: ['e2-micro', 'e2-small', 'e2-medium', 'e2-standard-2', 'e2-standard-4', 'n2-standard-2', 'n2-standard-4']
};

class AIRecommendationService {
  constructor() {
    this.isModelLoaded = false;
    this.modelPath = './models';
  }

  async initializeModel() {
    try {
      if (!fs.existsSync(this.modelPath)) {
        fs.mkdirSync(this.modelPath, { recursive: true });
      }
      this.isModelLoaded = false; // rule-based only
      console.log('✅ AI service initialized (rule-based)');
    } catch (error) {
      console.error('Model initialization error:', error);
      throw error;
    }
  }

  async generateRecommendations(userId) {
    console.log('🔍 Generating recommendations for user:', userId);
    // Run rule-based resource recommendations
    const base = await this.getRuleBasedRecommendations(userId);
    // Run log-based analysis
    const logInsights = await this.getLogDrivenRecommendations(userId);
    // Run metrics-driven recommendations (real CloudMetrics data)
    const metricsInsights = await this.getMetricsDrivenRecommendations(userId);
    // Merge & annotate
    const combined = [
      ...metricsInsights.recommendations,
      ...logInsights.recommendations,
      ...base.recommendations,
    ];

    // Guarantee at least two actionable recommendations
    if (combined.length < 2) {
      combined.push({
        type: 'governance',
        description: 'Enable budget alerts and anomaly notifications to catch cost spikes early.',
        potentialSavings: 0,
        priority: 'low',
        difficulty: 'easy',
        confidence: 80,
        routePath: '/dashboard/analytics',
        routeLabel: 'Open Predictive Analytics'
      });
    }
    if (combined.length < 2) {
      combined.push({
        type: 'cleanup',
        description: 'Review idle/unused resources and volumes to reduce cost and emissions.',
        potentialSavings: 5,
        priority: 'medium',
        difficulty: 'easy',
        confidence: 70,
        routePath: '/dashboard/carbon-tracking',
        routeLabel: 'Open Carbon Tracking'
      });
    }

    return {
      recommendations: combined,
      message: 'Combined rule + log + metrics recommendations',
      dataSource: 'rules+logs+metrics',
      logSummary: logInsights.logSummary || {},
      ...(base.extra || {}),
    };
  }

  async getRuleBasedRecommendations(userId) {
    try {
      // Ensure we query with ObjectId
      const objectId = new mongoose.Types.ObjectId(userId);

      let recentData = await AITrainingData.findOne({ userId: objectId })
        .sort({ timestamp: -1 });

      // 🔥 Fallback: auto-create mock data if none exists
      if (!recentData) {
        console.log('⚠️ No training data found, inserting mock record');
        recentData = await AITrainingData.create({
          userId: objectId,
          usageMetrics: {
            cpuUtilization: 75,
            memoryUsage: 4096,
            storageUsage: 200,
            networkTraffic: 800
          },
          carbonEmissions: 2.5,
          costData: 60,
          optimizationApplied: false
        });
      }

      const recommendations = [];
      const { cpuUtilization, memoryUsage, networkTraffic } = recentData.usageMetrics;

      if (cpuUtilization > 80) {
        recommendations.push({
          type: 'resize',
          description: 'CPU usage is high (>80%). Consider upgrading instance type.',
          potentialSavings: 0,
          priority: 'high',
          difficulty: 'medium',
          confidence: 90
        });
      }

      if (cpuUtilization < 20 && memoryUsage < 30) {
        recommendations.push({
          type: 'resize',
          description: 'Resources underutilized. Consider downsizing to save costs.',
          potentialSavings: recentData.costData * 0.3,
          priority: 'medium',
          difficulty: 'easy',
          confidence: 85
        });
      }

      if (networkTraffic > 1000) {
        recommendations.push({
          type: 'optimize',
          description: 'High network usage. Consider caching or CDN.',
          potentialSavings: recentData.costData * 0.15,
          priority: 'medium',
          difficulty: 'medium',
          confidence: 75
        });
      }

      if (recommendations.length === 0) {
        recommendations.push({
          type: 'optimize',
          description: 'Configuration looks optimized. Continue monitoring.',
          potentialSavings: 0,
          priority: 'low',
          difficulty: 'easy',
          confidence: 60
        });
      }

      return {
        recommendations,
        message: 'Rule-based recommendations generated',
        dataSource: 'rules'
      };

    } catch (error) {
      console.error('Recommendation error:', error);
      return {
        recommendations: [],
        message: 'Error generating recommendations',
        dataSource: 'error'
      };
    }
  }

  /**
   * Analyze recent issue logs (errors/warns) to derive remediation, reliability and cost/carbon suggestions.
   * Currently only AWS implemented; future providers can be merged here.
   */
  async getLogDrivenRecommendations(userId) {
    try {
      const lookbackMinutes = parseInt(process.env.AI_LOG_ANALYSIS_MINUTES || '120', 10); // 2h default
      const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);
      const q = { timestamp: { $gte: since } };
      // Multi-tenant filter (user or global null)
      try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        q.$or = [{ userId: userObjectId }, { userId: null }];
      } catch (_) { /* ignore */ }

      const logs = await AwsIssueLog.find(q).lean();
      const recs = [];
      if (!logs.length) {
        return { recommendations: [], logSummary: { lookbackMinutes, total: 0 } };
      }

      // Aggregate metrics
      const byLevel = logs.reduce((acc, l) => { acc[l.level] = (acc[l.level]||0)+1; return acc; }, {});
      const byGroup = logs.reduce((acc, l) => { acc[l.logGroup] = (acc[l.logGroup]||0)+1; return acc; }, {});
      const topGroups = Object.entries(byGroup).sort((a,b)=>b[1]-a[1]).slice(0,5);

      // Heuristics for recommendations
      const totalErrors = byLevel.error || 0;
      const totalWarns = byLevel.warn || 0;

      // Rough per-issue size estimate (bytes) for cost/carbon (message + overhead)
      const estimatedBytes = logs.reduce((sum, l) => sum + Buffer.byteLength(l.message || '', 'utf8') + 200, 0);
      const bytesPerGB = 1024 ** 3;
      const gb = estimatedBytes / bytesPerGB;
      // Simple AWS CloudWatch Logs storage pricing placeholder (e.g., $0.50 per GB / month) adjustable via env
      const pricePerGB = parseFloat(process.env.LOG_STORAGE_PRICE_PER_GB || '0.50');
      const estMonthlyCost = parseFloat((gb * pricePerGB).toFixed(2));
      // Carbon intensity placeholder (kg CO2e per GB stored+processed) adjustable via env
      const carbonPerGB = parseFloat(process.env.LOG_STORAGE_CARBON_KG_PER_GB || '0.1');
      const estCarbonKg = parseFloat((gb * carbonPerGB).toFixed(3));

      if (totalErrors > 50) {
        recs.push({
          type: 'stability',
          description: `High error volume (${totalErrors}) in last ${lookbackMinutes}m – prioritize incident triage & root cause analysis.`,
          potentialSavings: 0,
          priority: 'high',
          difficulty: 'medium',
          confidence: 85,
          provider: 'aws',
          routePath: '/cloud-monitoring/aws',
          routeLabel: 'Open Cloud Monitoring (AWS)',
          evidence: { errors: totalErrors, warnings: totalWarns, storageGB: parseFloat(gb.toFixed(3)) },
          links: [
            { label: 'AWS CloudWatch Alarm Docs', url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html' },
            { label: 'Incident Playbooks Guide', url: 'https://sre.google/sre-book/incident-response/' }
          ]
        });
      } else if (totalErrors > 0) {
        recs.push({
          type: 'stability',
          description: `${totalErrors} errors detected – ensure alerting & runbooks exist.`,
          potentialSavings: 0,
          priority: 'medium',
          difficulty: 'easy',
          confidence: 70,
          provider: 'aws',
          routePath: '/cloud-monitoring/aws',
          routeLabel: 'Open Cloud Monitoring (AWS)',
          evidence: { errors: totalErrors, warnings: totalWarns },
          links: [
            { label: 'Set Up CloudWatch Alarms', url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html' }
          ]
        });
      }

      if (totalWarns > 100) {
        recs.push({
          type: 'performance',
          description: `Large number of warnings (${totalWarns}) – review throttling / capacity / deprecation notices.`,
          potentialSavings: 0,
          priority: 'medium',
          difficulty: 'medium',
          confidence: 75,
          provider: 'aws',
          routePath: '/cloud-monitoring/aws',
          routeLabel: 'Open Cloud Monitoring (AWS)',
          evidence: { warnings: totalWarns },
          links: [
            { label: 'AWS Throttling Guidance', url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html' }
          ]
        });
      }

      // Examine repeated messages for possible optimization (simple high-frequency text stems)
      const messageCounts = {};
      logs.forEach(l => {
        const norm = (l.message||'').slice(0, 120).toLowerCase();
        messageCounts[norm] = (messageCounts[norm]||0)+1;
      });
      const noisy = Object.entries(messageCounts).filter(([,c])=>c>=10).sort((a,b)=>b[1]-a[1]).slice(0,3);
      noisy.forEach(([snippet, count]) => {
        recs.push({
          type: 'noise-reduction',
          description: `Log pattern '${snippet.slice(0,50)}...' repeated ${count} times – consider deduplication, sampling or fixing root cause to cut storage & carbon.`,
          potentialSavings: Math.min(5, count * 0.1), // rough placeholder
          priority: 'low',
          difficulty: 'easy',
          confidence: 60,
          provider: 'aws',
          routePath: '/cloud-monitoring/aws',
          routeLabel: 'Open Cloud Monitoring (AWS)',
          evidence: { repeats: count },
          links: [
            { label: 'CloudWatch Logs Insights Optimization', url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html' }
          ]
        });
      });

      // Suggest retention review if total volume high
      const total = logs.length;
      if (total > 500) {
        recs.push({
          type: 'cost',
          description: `High log retention volume (${total} issues in ${lookbackMinutes}m). Review log retention & sampling to reduce cost & emissions.`,
          potentialSavings: 10,
          priority: 'medium',
          difficulty: 'easy',
          confidence: 65,
          provider: 'aws',
          routePath: '/dashboard/analytics?provider=aws',
          routeLabel: 'Open Predictive Analytics',
          evidence: { issues: total, storageGB: parseFloat(gb.toFixed(3)), monthlyCost: estMonthlyCost, carbonKg: estCarbonKg },
          links: [
            { label: 'Optimize CloudWatch Log Retention', url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SettingLogRetention.html' }
          ]
        });
      }

      // Top noisy log group advice
      if (topGroups.length) {
        const [grp, count] = topGroups[0];
        if (count > 25) {
          recs.push({
            type: 'targeted-investigation',
            description: `Log group '${grp}' produced ${count} issue events – prioritize investigation or add guardrails.`,
            potentialSavings: 0,
            priority: 'medium',
            difficulty: 'medium',
            confidence: 70,
            provider: 'aws',
            routePath: '/cloud-monitoring/aws',
            routeLabel: 'Open Cloud Monitoring (AWS)',
            evidence: { logGroup: grp, count },
            links: [
              { label: 'CloudWatch Logs Best Practices', url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html' }
            ]
          });
        }
      }

      return {
        recommendations: recs,
        logSummary: {
          lookbackMinutes,
            total,
            levels: byLevel,
            topGroups: topGroups.map(([g,c])=>({ group: g, count: c })),
            noisyPatterns: noisy.map(([s,c])=>({ snippet: s, count: c })),
            estimatedStorageGB: parseFloat(gb.toFixed(4)),
            estimatedMonthlyStorageCost: estMonthlyCost,
            estimatedCarbonKg: estCarbonKg
        }
      };
    } catch (e) {
      console.error('Log-based recommendation error:', e.message);
      return { recommendations: [], logSummary: { error: e.message } };
    }
  }

  // New: derive recommendations from recent CloudMetrics (real data)
  async getMetricsDrivenRecommendations(userId) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      // get the latest metric per provider
      const providers = ['aws','azure','gcp'];
      const latestByProvider = await Promise.all(providers.map(async (prov) => {
        const doc = await CloudMetrics.findOne({ userId: userObjectId, provider: prov }).sort({ timestamp: -1 }).lean();
        return { prov, doc };
      }));

      const recs = [];
      latestByProvider.forEach(({ prov, doc }) => {
        if (!doc) return;
        const avgCPU = doc?.metrics?.summary?.avgCPU || 0;
        const instances = doc?.metrics?.totalInstances || 0;
        const cost = doc?.cost || 0;
        const carbon = doc?.carbonFootprint || 0;
        const carbonPerDollar = cost > 0 ? parseFloat((carbon / cost).toFixed(3)) : 0;

        // Downsize if underutilized
        if (avgCPU < 15 && instances > 0 && cost > 0) {
          const potential = Math.round(cost * 0.3 * 100) / 100; // ~30%
          recs.push({
            type: 'resize',
            description: `${prov.toUpperCase()}: Underutilized (${avgCPU}% avg CPU). Consider downsizing instance types to save cost.`,
            potentialSavings: potential,
            priority: 'high',
            difficulty: 'easy',
            confidence: 85,
            provider: prov,
            routePath: `/cloud-monitoring/${prov}`,
            routeLabel: `Open Cloud Monitoring (${prov.toUpperCase()})`,
            evidence: { avgCPU, instances, cost },
          });
        }

        // Scale up if saturated
        if (avgCPU > 85 && instances > 0) {
          recs.push({
            type: 'performance',
            description: `${prov.toUpperCase()} workloads near saturation (${avgCPU}% avg CPU). Consider right-sizing or enabling auto-scaling.`,
            potentialSavings: 0,
            priority: 'medium',
            difficulty: 'medium',
            confidence: 75,
            provider: prov,
            routePath: `/cloud-monitoring/${prov}`,
            routeLabel: `Open Cloud Monitoring (${prov.toUpperCase()})`,
            evidence: { avgCPU, instances }
          });
        }

        // Carbon optimization suggestion when carbon/cost ratio is high
        const ratio = cost > 0 ? (carbon / cost) : 0; // kg per $
        if (ratio > 0.8) { // heuristic threshold
          recs.push({
            type: 'carbon',
            description: `${prov.toUpperCase()}: High emissions per dollar. Review workload placement and consider migrating low-risk jobs to greener regions/providers.`,
            potentialSavings: Math.round(carbon * 0.15), // rough emission reduction proxy
            priority: 'medium',
            difficulty: 'medium',
            confidence: 65,
            provider: prov,
            routePath: `/dashboard/carbon-tracking?provider=${prov}`,
            routeLabel: 'Open Carbon Tracking',
            evidence: { carbon, cost, carbonPerDollar },
          });
        }
      });

      // Cross-provider migration suggestion: find greener provider
      const existing = latestByProvider.filter(x=>x.doc);
      if (existing.length >= 2) {
        const sorted = existing.sort((a,b)=> (a.doc.carbonFootprint||0) - (b.doc.carbonFootprint||0));
        const greener = sorted[0].prov;
        const heavier = sorted[sorted.length-1].prov;
        if (greener !== heavier) {
          recs.push({
            type: 'migration',
            description: `Consider migrating ~25% of non-critical workloads from ${heavier.toUpperCase()} to ${greener.toUpperCase()} to reduce emissions and possibly costs.`,
            potentialSavings: 0,
            priority: 'low',
            difficulty: 'medium',
            confidence: 60,
            provider: heavier,
            targetProvider: greener,
            routePath: `/dashboard/analytics?provider=${heavier}`,
            routeLabel: 'Open Predictive Analytics'
          });
        }
      }

      // Ensure minimum 2 recommendations per provider
      const ensureMin = 2;
      for (const prov of providers) {
        const count = recs.filter(r => r.provider === prov).length;
        const fillers = [];
        if (count < ensureMin) {
          fillers.push({
            type: 'governance',
            description: `${prov.toUpperCase()}: Enable budget alerts and anomaly notifications to catch cost spikes early.`,
            potentialSavings: 0,
            priority: 'low',
            difficulty: 'easy',
            confidence: 80,
            provider: prov,
            routePath: `/dashboard/analytics?provider=${prov}`,
            routeLabel: 'Open Predictive Analytics'
          });
          fillers.push({
            type: 'cleanup',
            description: `${prov.toUpperCase()}: Review idle/unused resources, snapshots, and unattached volumes to reduce cost and emissions.`,
            potentialSavings: 5,
            priority: 'medium',
            difficulty: 'easy',
            confidence: 70,
            provider: prov,
            routePath: `/cloud-monitoring/${prov}`,
            routeLabel: `Open Cloud Monitoring (${prov.toUpperCase()})`
          });
        }
        while (recs.filter(r => r.provider === prov).length < ensureMin && fillers.length) {
          recs.push(fillers.shift());
        }
      }

      return { recommendations: recs };
    } catch (e) {
      console.error('Metrics-driven recommendation error:', e.message);
      return { recommendations: [] };
    }
  }

  /**
   * Instance-level rightsizing based on recent CloudMetrics instances
   * @param {string} userId - User ID
   * @param {string} provider - Cloud provider (aws, azure, gcp)
   * @returns {Promise<Object>} Rightsizing recommendations
   */
  async getRightsizingRecommendations(userId, provider = 'aws') {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      const doc = await CloudMetrics.findOne({ userId: objectId, provider }).sort({ timestamp: -1 }).lean();

      if (!doc || !doc.metrics?.instances?.length) {
        return { recommendations: [], message: 'No instance metrics found for rightsizing' };
      }

      const instances = doc.metrics.instances;
      const defaultPerInstanceCost = doc.cost && instances.length ? doc.cost / instances.length : 0;
      const priceCatalog = RIGHTSIZING_PRICING[provider] || {};
      const order = RIGHTSIZING_ORDER[provider] || [];
      const recommendations = [];

      instances.forEach((instance) => {
        const avgCpu = this._getAverageCpu(instance);
        if (avgCpu === null) return; // skip when no data

        const currentType = instance.instanceType || 'unknown';
        const currentPrice = priceCatalog[currentType] || defaultPerInstanceCost || 0;
        const smallerType = this._getNextSmallerType(provider, currentType);
        const avgMemory = this._getAverageMemory(instance);

        // Only suggest downsizing when clear underutilization
        if (avgCpu < 20 && smallerType) {
          const recommendedPrice = priceCatalog[smallerType] || currentPrice * 0.65; // fallback ratio
          const estimatedSavings = Math.max(0, currentPrice - recommendedPrice);

          recommendations.push({
            instanceId: instance.instanceId,
            provider,
            currentType,
            recommendedType: smallerType,
            avgCpuUtilization: parseFloat(avgCpu.toFixed(1)),
            memoryUtilization: avgMemory === null ? null : parseFloat(avgMemory.toFixed(1)),
            estimatedMonthlySavings: parseFloat(estimatedSavings.toFixed(2)),
            confidence: 85,
            reason: 'CPU under 20% indicates sustained idle capacity. Downsizing should cut cost without impacting performance.',
            routePath: `/cloud-monitoring/${provider}`,
            routeLabel: `Open Cloud Monitoring (${provider.toUpperCase()})`
          });
        }

        // Guidance for saturated instances (no savings but actionable)
        if (avgCpu > 85) {
          recommendations.push({
            instanceId: instance.instanceId,
            provider,
            currentType,
            recommendedType: currentType,
            avgCpuUtilization: parseFloat(avgCpu.toFixed(1)),
            memoryUtilization: avgMemory === null ? null : parseFloat(avgMemory.toFixed(1)),
            estimatedMonthlySavings: 0,
            confidence: 70,
            reason: 'CPU above 85%—enable auto-scaling or upsize to avoid throttling.',
            routePath: `/cloud-monitoring/${provider}`,
            routeLabel: `Open Cloud Monitoring (${provider.toUpperCase()})`
          });
        }
      });

      // Fallback guidance if nothing actionable
      if (!recommendations.length) {
        recommendations.push({
          provider,
          currentType: null,
          recommendedType: null,
          estimatedMonthlySavings: 0,
          confidence: 60,
          reason: 'No underutilized instances detected. Keep monitoring utilization trends.',
          routePath: `/cloud-monitoring/${provider}`,
          routeLabel: `Open Cloud Monitoring (${provider.toUpperCase()})`
        });
      }

      return { recommendations, instancesAnalyzed: instances.length };
    } catch (error) {
      console.error('Rightsizing recommendation error:', error.message);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Detect cost anomalies using statistical analysis
   * @param {string} userId - User ID
   * @param {string} provider - Cloud provider (aws, azure, gcp)
   * @returns {Promise<Object>} Anomalies detected
   */
  async detectCostAnomalies(userId, provider = 'aws') {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      
      // Get last 30 days of cloud metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const historicalData = await CloudMetrics.find({
        userId: objectId,
        provider: provider,
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: -1 }).limit(30);

      if (historicalData.length < 3) {
        console.log('⚠️ Not enough historical data for anomaly detection');
        return { anomalies: [], message: 'Insufficient historical data' };
      }

      // Extract cost values
      const costValues = historicalData
        .map(m => m.metrics?.totalCost || 0)
        .filter(v => v > 0)
        .reverse();

      if (costValues.length < 3) {
        return { anomalies: [], message: 'Not enough cost data' };
      }

      // Calculate statistics
      const stats = this._calculateStats(costValues);
      const anomalies = [];

      // Check latest value against threshold (mean + 2*stdDev)
      const latestCost = costValues[costValues.length - 1];
      const threshold = stats.mean + (2 * stats.stdDev);

      if (latestCost > threshold) {
        const percentageIncrease = ((latestCost - stats.mean) / stats.mean) * 100;
        const zScore = (latestCost - stats.mean) / stats.stdDev;
        
        const anomaly = await AnomalyAlert.create({
          userId: objectId,
          anomalyType: 'cost_spike',
          provider: provider,
          resourceType: 'general',
          metricName: 'totalCost',
          normalValue: stats.mean,
          anomalousValue: latestCost,
          threshold: threshold,
          percentageIncrease: parseFloat(percentageIncrease.toFixed(2)),
          zScore: parseFloat(zScore.toFixed(2)),
          severity: this._calculateSeverity(zScore),
          description: `Cost spike detected: $${latestCost.toFixed(2)} vs average $${stats.mean.toFixed(2)} (${percentageIncrease.toFixed(0)}% increase)`,
          recommendation: `Review recent resource deployments and running instances. Consider stopping idle resources to reduce costs.`,
          estimatedCostImpact: latestCost - stats.mean,
          historicalAverage: stats.mean,
          historicalStdDev: stats.stdDev
        });
        
        anomalies.push(anomaly);
      }

      return { anomalies };
    } catch (error) {
      console.error('Cost anomaly detection error:', error);
      return { anomalies: [], error: error.message };
    }
  }

  /**
   * Detect resource utilization anomalies
   * @param {string} userId - User ID
   * @param {string} provider - Cloud provider
   * @param {string} resourceId - Optional specific resource ID
   * @returns {Promise<Object>} Anomalies detected
   */
  async detectUtilizationAnomalies(userId, provider = 'aws', resourceId = null) {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const historicalData = await CloudMetrics.find({
        userId: objectId,
        provider: provider,
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: -1 }).limit(30);

      const anomalies = [];

      // Check each instance for low utilization (potential waste)
      for (const metric of historicalData) {
        if (metric.metrics?.instances) {
          for (const instance of metric.metrics.instances) {
            // Skip if filtering by resourceId
            if (resourceId && instance.instanceId !== resourceId) continue;

            // Get CPU utilization
            const cpuValues = instance.cpu?.map(c => c.Average) || [];
            if (cpuValues.length < 3) continue;

            const cpuStats = this._calculateStats(cpuValues);
            
            // Flag low CPU utilization (< 5%)
            if (cpuStats.mean < 5) {
              const anomaly = await AnomalyAlert.create({
                userId: objectId,
                anomalyType: 'cpu_spike', // reusing for underutilization
                provider: provider,
                resourceId: instance.instanceId,
                resourceType: 'instance',
                metricName: 'cpuUtilization',
                normalValue: 30, // target
                anomalousValue: cpuStats.mean,
                threshold: 5,
                percentageIncrease: 0,
                zScore: 0,
                severity: 'low',
                description: `Low CPU utilization detected on ${instance.instanceType} (${instance.instanceId}): ${cpuStats.mean.toFixed(1)}% average`,
                recommendation: `Consider downgrading to a smaller instance type or stopping this instance if not needed.`,
                estimatedCostImpact: 0,
                historicalAverage: cpuStats.mean,
                historicalStdDev: cpuStats.stdDev
              });
              
              anomalies.push(anomaly);
            }
          }
        }
      }

      return { anomalies };
    } catch (error) {
      console.error('Utilization anomaly detection error:', error);
      return { anomalies: [], error: error.message };
    }
  }

  /**
   * Get all active anomalies for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters (provider, anomalyType, severity)
   * @returns {Promise<Array>} List of anomalies
   */
  async getAnomalies(userId, filters = {}) {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      
      const query = { userId: objectId };
      
      if (filters.provider) query.provider = filters.provider;
      if (filters.anomalyType) query.anomalyType = filters.anomalyType;
      if (filters.severity) query.severity = filters.severity;
      if (filters.status) query.status = filters.status;

      const anomalies = await AnomalyAlert.find(query)
        .sort({ detectedAt: -1 })
        .limit(100);

      return anomalies;
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an anomaly alert
   * @param {string} userId - User ID
   * @param {string} anomalyId - Anomaly ID
   * @returns {Promise<Object>} Updated anomaly
   */
  async acknowledgeAnomaly(userId, anomalyId) {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      const anomalyObjectId = new mongoose.Types.ObjectId(anomalyId);

      const updated = await AnomalyAlert.findOneAndUpdate(
        { _id: anomalyObjectId, userId: objectId },
        {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: userId
        },
        { new: true }
      );

      if (!updated) {
        throw new Error('Anomaly not found');
      }

      return updated;
    } catch (error) {
      console.error('Error acknowledging anomaly:', error);
      throw error;
    }
  }

  /**
   * Dismiss an anomaly alert
   * @param {string} userId - User ID
   * @param {string} anomalyId - Anomaly ID
   * @returns {Promise<Object>} Updated anomaly
   */
  async dismissAnomaly(userId, anomalyId) {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);
      const anomalyObjectId = new mongoose.Types.ObjectId(anomalyId);

      const updated = await AnomalyAlert.findOneAndUpdate(
        { _id: anomalyObjectId, userId: objectId },
        {
          status: 'dismissed',
          acknowledgedAt: new Date()
        },
        { new: true }
      );

      if (!updated) {
        throw new Error('Anomaly not found');
      }

      return updated;
    } catch (error) {
      console.error('Error dismissing anomaly:', error);
      throw error;
    }
  }

  /**
   * Helper: Average CPU from instance metrics
   * @private
   */
  _getAverageCpu(instance) {
    const cpuValues = instance?.cpu?.map(c => c.Average).filter(v => typeof v === 'number') || [];
    if (!cpuValues.length) return null;
    const sum = cpuValues.reduce((acc, v) => acc + v, 0);
    return sum / cpuValues.length;
  }

  /**
   * Helper: Average memory from instance metrics (if present)
   * @private
   */
  _getAverageMemory(instance) {
    const memValues = instance?.memory?.map(m => m.Average).filter(v => typeof v === 'number') || [];
    if (!memValues.length) return null;
    const sum = memValues.reduce((acc, v) => acc + v, 0);
    return sum / memValues.length;
  }

  /**
   * Helper: Get next smaller instance type for provider
   * @private
   */
  _getNextSmallerType(provider, currentType) {
    const order = RIGHTSIZING_ORDER[provider] || [];
    const idx = order.indexOf(currentType);
    if (idx > 0) return order[idx - 1];
    return null;
  }

  /**
   * Helper: Calculate statistical metrics
   * @private
   */
  _calculateStats(values) {
    if (!values || values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * Helper: Calculate severity based on Z-score
   * @private
   */
  _calculateSeverity(zScore) {
    const absZ = Math.abs(zScore);
    if (absZ > 4) return 'critical';
    if (absZ > 3) return 'high';
    if (absZ > 2) return 'medium';
    return 'low';
  }
}

export default new AIRecommendationService();
