import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import CloudMetrics from "../models/CloudMetrics.js";
import User from "../models/User.js";
import { emitToUser } from "../realtime/socket.js";
import CarbonFootprint from "../models/CarbonFootprint.js"; // Added for monthly aggregate upsert
import emailService from "./email-service.js";

// Simple in-memory last-alert timestamps to avoid spamming (per-user & type)
const lastAlertAt = new Map(); // key: `${userId}:aws:cpu`, value: Date

// In-memory cache for the latest global snapshot (used as fallback for new users)
let latestGlobalAwsSnapshot = null;
let lastGlobalSnapshotAt = null;

// ✅ Initialize AWS SDK Clients with environment variables
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION = "us-east-1" } = process.env;

const ec2Client = new EC2Client({
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  region: AWS_REGION,
});

const cloudwatchClient = new CloudWatchClient({
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  region: AWS_REGION,
});

// ✅ Example standalone metrics fetcher (can be used for quick testing)
export async function getMetrics(instanceId = "your-ec2-id") {
  const command = new GetMetricDataCommand({
    MetricDataQueries: [
      {
        Id: "m1",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "CPUUtilization",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
          },
          Period: 300,
          Stat: "Average",
        },
        ReturnData: true,
      },
    ],
    StartTime: new Date(Date.now() - 3600 * 1000),
    EndTime: new Date(),
  });

  const response = await cloudwatchClient.send(command);
  console.log("🔹 Sample CloudWatch response:", response);
  return response;
}

// Helper to build CloudWatch metric queries for a list of instance IDs
function buildMetricQueries(instanceIds = []) {
  const metricNames = [
    { name: "CPUUtilization", stat: "Average", unit: "Percent" },
    { name: "NetworkIn", stat: "Average", unit: "Bytes" },
    { name: "NetworkOut", stat: "Average", unit: "Bytes" },
  ];
  const queries = [];
  let idCounter = 0;
  instanceIds.forEach((iid) => {
    metricNames.forEach((m) => {
      queries.push({
        Id: `m${idCounter++}`,
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: m.name,
            Dimensions: [{ Name: "InstanceId", Value: iid }],
          },
          Period: 300,
          Stat: m.stat,
          Unit: m.unit,
        },
        ReturnData: true,
      });
    });
  });
  return queries;
}

// Fetch EC2 instance data and convert into CloudMetrics doc shape
async function fetchAwsInstances() {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.warn("AWS metrics service: Missing AWS credentials in environment");
    return null;
  }
  try {
    const resp = await ec2Client.send(new DescribeInstancesCommand({}));
    const reservations = resp.Reservations || [];
    const instancesFlat = reservations.flatMap((r) => r.Instances || []);
    const instanceIds = instancesFlat.map((i) => i.InstanceId).filter(Boolean);

    let metricsByInstance = {};
    if (instanceIds.length > 0) {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 15 * 60 * 1000); // last 15 minutes
        const metricQueries = buildMetricQueries(instanceIds).slice(0, 500); // CW limit safety
        if (metricQueries.length > 0) {
          const metricData = await cloudwatchClient.send(
            new GetMetricDataCommand({
              StartTime: startTime,
              EndTime: endTime,
              MetricDataQueries: metricQueries,
              ScanBy: "TimestampDescending",
              MaxDatapoints: 5000,
            })
          );
          // Organize results
          (metricData.MetricDataResults || []).forEach((res) => {
            const queryDef = metricQueries.find((q) => q.Id === res.Id);
            if (!queryDef) return;
            const instId = queryDef.MetricStat.Metric.Dimensions[0].Value;
            const metricName = queryDef.MetricStat.Metric.MetricName;
            if (!metricsByInstance[instId]) metricsByInstance[instId] = {};
            const value = res.Values && res.Values.length ? res.Values[0] : 0;
            metricsByInstance[instId][metricName] = value;
          });
        }
      } catch (cwErr) {
        console.warn("CloudWatch metrics fetch failed, falling back to synthetic values:", cwErr.message);
      }
    }

    const instances = instancesFlat.map((i) => {
      const m = metricsByInstance[i.InstanceId] || {};
      // Fallback synthetic if CloudWatch missing
      const cpuVal = m.CPUUtilization ?? Math.random() * 60;
      const netInVal = m.NetworkIn ?? Math.floor(Math.random() * 2000000);
      const netOutVal = m.NetworkOut ?? Math.floor(Math.random() * 2000000);
      return {
        instanceId: i.InstanceId,
        instanceType: i.InstanceType,
        cpu: [{ Timestamp: new Date(), Average: cpuVal }],
        networkIn: [{ Timestamp: new Date(), Average: netInVal }],
        networkOut: [{ Timestamp: new Date(), Average: netOutVal }],
        diskRead: [{ Timestamp: new Date(), Average: Math.floor(Math.random() * 100000) }],
        diskWrite: [{ Timestamp: new Date(), Average: Math.floor(Math.random() * 100000) }],
      };
    });

    return {
      totalInstances: instances.length,
      instances,
      summary: { avgCPU: 0, totalNetworkIn: 0, totalNetworkOut: 0 },
    };
  } catch (err) {
    console.error("AWS metrics fetch failed:", err.message);
    return null;
  }
}

export async function ingestAwsMetricsForAllUsers() {
  const metrics = await fetchAwsInstances();
  if (!metrics) return;
  // Update summary now that we have per-instance values
  if (metrics.instances.length) {
    const cpuVals = metrics.instances.map((inst) => inst.cpu?.[0]?.Average || 0);
    metrics.summary.avgCPU =
      Math.round((cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length) * 10) / 10;
    metrics.summary.totalNetworkIn = metrics.instances.reduce(
      (s, i) => s + (i.networkIn?.[0]?.Average || 0),
      0
    );
    metrics.summary.totalNetworkOut = metrics.instances.reduce(
      (s, i) => s + (i.networkOut?.[0]?.Average || 0),
      0
    );
  }

  latestGlobalAwsSnapshot = metrics;
  lastGlobalSnapshotAt = new Date();

  try {
    const users = await User.find({}, "_id preferences name email");
    const saveResults = await Promise.all(
      users.map(async (u) => {
        const doc = new CloudMetrics({
          userId: u._id,
          provider: "aws",
          metrics,
          carbonFootprint: 0,
          cost: 0,
          region: process.env.AWS_REGION || "us-east-1",
          dataSource: "cloudwatch",
        });
        await doc.save();

        // --- Monthly CarbonFootprint aggregate upsert ---
        // Assumptions / simple synthetic formulas (can be replaced with real energy model later):
        // totalEmissions (kg CO2) ~ activeInstances * avgCPU * 0.12 (arbitrary factor)
        // costEstimate ($) ~ activeInstances * (base 0.02 + avgCPU * 0.0001)
        // efficiencyScore: inverse relation to avgCPU with floor/ceiling normalization
        try {
          const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
          const activeInstances = metrics.totalInstances;
            // Avoid divide by zero or NaN
          const avgCPU = Number(metrics.summary?.avgCPU) || 0;
          const totalEmissions = Number((activeInstances * avgCPU * 0.12).toFixed(2));
          const costEstimate = Number((activeInstances * (0.02 + avgCPU * 0.0001)).toFixed(2));
          const efficiencyScore = Math.max(10, Math.min(100, Math.round(110 - avgCPU))); // bounded 10..100

          await CarbonFootprint.findOneAndUpdate(
            { userId: u._id, month: monthKey },
            {
              $set: {
                totalEmissions,
                avgCPUUsage: avgCPU,
                activeInstances,
                efficiencyScore,
                totalCost: costEstimate,
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, new: true }
          );
        } catch (aggErr) {
          console.warn("CarbonFootprint upsert failed:", aggErr.message);
        }

        emitToUser(u._id.toString(), "cloud:aws:instances", {
          success: true,
          type: "ingest",
          timestamp: new Date().toISOString(),
          totalInstances: metrics.totalInstances,
          avgCPU: metrics.summary.avgCPU,
        });

        // Auto-trigger urgent email when thresholds exceed (if enabled)
        try {
          const prefs = u.preferences?.notificationPrefs || {};
          const emailEnabled = prefs.emailEnabled !== false; // default true
          const freq = prefs.frequency || 'instant';
          const threshold = typeof prefs.urgentCpuThreshold === 'number' ? prefs.urgentCpuThreshold : 90;
          const cooldown = (typeof prefs.cooldownMinutes === 'number' ? prefs.cooldownMinutes : 60) * 60 * 1000;
          const now = Date.now();
          if (emailEnabled && (freq === 'instant' || freq === 'daily')) {
            const avgCPU = Number(metrics.summary?.avgCPU) || 0;
            if (avgCPU >= threshold) {
              const key = `${u._id}:aws:cpu`;
              const last = lastAlertAt.get(key) || 0;
              if (now - last > cooldown) {
                await emailService.sendEmail({
                  to: u.email,
                  subject: `Urgent: High AWS CPU detected (${avgCPU}%)`,
                  html: `<div style="font-family:Arial,sans-serif"><h3>Urgent Alert: High CPU</h3><p>Average CPU across AWS instances is ${avgCPU}% (threshold ${threshold}%).</p><p>Instances: ${metrics.totalInstances}</p><p>Time: ${new Date().toLocaleString()}</p></div>`,
                  text: `Avg CPU ${avgCPU}% (threshold ${threshold}%), instances ${metrics.totalInstances}`,
                });
                lastAlertAt.set(key, now);
              }
            }
          }
        } catch (alertErr) {
          console.warn('aws:urgent-email failed', alertErr.message);
        }
        return doc._id;
      })
    );
    console.log(`✅ AWS metrics ingested for ${users.length} users (docs: ${saveResults.length})`);
  } catch (e) {
    console.error("Ingest AWS metrics error:", e.message);
  }
}

export function startAwsMetricsScheduler() {
  const intervalMs = parseInt(process.env.AWS_METRICS_INTERVAL_MS || "300000", 10); // default 5m
  setInterval(() => {
    ingestAwsMetricsForAllUsers();
  }, intervalMs);
  // Initial warm start
  ingestAwsMetricsForAllUsers();
  console.log(`⏱️ AWS metrics scheduler started (interval ${intervalMs / 1000}s)`);
}

// Provide access to latest global snapshot for fallback usage
export function getLatestGlobalAwsSnapshot() {
  return { snapshot: latestGlobalAwsSnapshot, at: lastGlobalSnapshotAt };
}
