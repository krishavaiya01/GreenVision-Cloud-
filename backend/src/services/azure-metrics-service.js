import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { MetricsQueryClient } from "@azure/monitor-query";
import CloudMetrics from "../models/CloudMetrics.js";
import User from "../models/User.js";
import CarbonFootprint from "../models/CarbonFootprint.js";
import { emitToUser } from "../realtime/socket.js";
import azureInventory from "./azure-resource-service.js";
import { DefaultAzureCredential as AZDefault, ClientSecretCredential as AZSecret } from "@azure/identity";
import { ResourceManagementClient as AZResources } from "@azure/arm-resources";

// In-memory cache for the latest global snapshot (used as fallback for new users/UI)
let latestGlobalAzureSnapshot = null;
let lastGlobalAzureSnapshotAt = null;

function getAzureCredential() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (tenantId && clientId && clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return new DefaultAzureCredential();
}

function safeNumber(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}

// Extract the latest data point's aggregate value from Azure Metrics response
function getLatestAggregate(metric, key = "average") {
  if (!metric || !metric.timeseries || !metric.timeseries.length) return 0;
  const ts = metric.timeseries[0];
  const data = ts.data || [];
  if (!data.length) return 0;
  const last = data[data.length - 1];
  // Try preferred key, then fallbacks commonly present in Azure metrics
  return (
    safeNumber(last[key]) ||
    safeNumber(last.total) ||
    safeNumber(last.maximum) ||
    safeNumber(last.minimum) ||
    0
  );
}

// Query metrics for a single Web App (Microsoft.Web/sites)
async function queryWebAppMetrics(metricsClient, site) {
  // Prefer BytesReceived/BytesSent for network; CpuTime as surrogate for CPU load
  const metricNames = ["CpuTime", "BytesReceived", "BytesSent"]; // unit: seconds, bytes, bytes
  try {
    const result = await metricsClient.queryResource(site.id, metricNames, {
      timespan: "PT15M",
      aggregations: ["Average"],
    });
    const byName = new Map();
    for (const m of result.metrics || []) {
      byName.set(m.name?.value || m.name, m);
    }

    const cpuTimeSec = getLatestAggregate(byName.get("CpuTime"), "average");
    const bytesIn = getLatestAggregate(byName.get("BytesReceived"), "average");
    const bytesOut = getLatestAggregate(byName.get("BytesSent"), "average");

    // Rough CPU% surrogate from CpuTime over 15m window; cap at 100
    // If app consumed 90s CPU in last 900s, approximate ~10% single-core usage
    const cpuPctApprox = Math.max(0, Math.min(100, Math.round((cpuTimeSec / 900) * 100)));

    const now = new Date();
    return {
      instanceId: site.id,
      instanceType: site.kind || "webapp",
      cpu: [{ Timestamp: now, Average: cpuPctApprox }],
      networkIn: [{ Timestamp: now, Average: Math.round(bytesIn) }],
      networkOut: [{ Timestamp: now, Average: Math.round(bytesOut) }],
      // App Service exposes storage/disk metrics differently; set synthetic 0 for now
      diskRead: [{ Timestamp: now, Average: 0 }],
      diskWrite: [{ Timestamp: now, Average: 0 }],
      _location: site.location || "eastus",
    };
  } catch (e) {
    // On failure, return a synthetic but bounded instance entry so UI remains stable
    const now = new Date();
    return {
      instanceId: site.id,
      instanceType: site.kind || "webapp",
      cpu: [{ Timestamp: now, Average: 0 }],
      networkIn: [{ Timestamp: now, Average: 0 }],
      networkOut: [{ Timestamp: now, Average: 0 }],
      diskRead: [{ Timestamp: now, Average: 0 }],
      diskWrite: [{ Timestamp: now, Average: 0 }],
      _location: site.location || "eastus",
      _error: e.message,
    };
  }
}

async function fetchAzureInstancesMetrics() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    console.warn("Azure metrics service: Missing AZURE_SUBSCRIPTION_ID in environment");
    return null;
  }
  const credential = getAzureCredential();
  const metricsClient = new MetricsQueryClient(credential);

  // Use existing inventory service to list Web Apps and attempt to include VMs as separate instances
  let sites = [];
  let vms = [];
  try {
    const inv = await azureInventory.getInventory();
    sites = Array.isArray(inv.webApps) ? inv.webApps : [];
  } catch (e) {
    console.warn("Azure inventory fetch failed:", e.message);
  }

  // Try to list VMs (basic info) and gather simple metrics via MetricsQueryClient
  try {
    const cred = getAzureCredential();
    const resClient = new AZResources(cred, subscriptionId);
    const vmResources = [];
    for await (const r of resClient.resources.list()) {
      if (r.type && r.type.toLowerCase() === "microsoft.compute/virtualmachines") {
        vmResources.push(r);
      }
    }
    vms = vmResources.map(r => ({ id: r.id, name: r.name, location: r.location, kind: "vm" }));
  } catch (e) {
    console.warn("Azure VM discovery failed:", e.message);
  }

  // If no web apps found, provide a minimal synthetic metrics set so downstream remains consistent
  if (!sites.length) {
    const now = new Date();
    return {
      totalInstances: 0,
      instances: [],
      summary: { avgCPU: 0, totalNetworkIn: 0, totalNetworkOut: 0 },
      region: "eastus",
      note: "No Azure Web Apps discovered; metrics empty",
      capturedAt: now,
    };
  }

  // Query metrics per site with modest parallelism
  const concurrency = 5;
  const instances = [];
  for (let i = 0; i < sites.length; i += concurrency) {
    const batch = sites.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((s) => queryWebAppMetrics(metricsClient, s)));
    instances.push(...results);
  }

  // Query metrics for VMs (CPU Percentage, Network In/Out) if any VMs discovered
  async function queryVmMetrics(vm) {
    try {
      const metricNames = ["Percentage CPU", "Network In Total", "Network Out Total"]; // names vary by resource; using common forms
      const result = await metricsClient.queryResource(vm.id, metricNames, {
        timespan: "PT15M",
        aggregations: ["Average"],
      });
      const by = new Map();
      for (const m of result.metrics || []) by.set(m.name?.value || m.name, m);
      const cpu = getLatestAggregate(by.get("Percentage CPU"), "average");
      const netIn = getLatestAggregate(by.get("Network In Total"), "average");
      const netOut = getLatestAggregate(by.get("Network Out Total"), "average");
      const now = new Date();
      return {
        instanceId: vm.id,
        instanceType: "vm",
        cpu: [{ Timestamp: now, Average: Math.round(cpu) }],
        networkIn: [{ Timestamp: now, Average: Math.round(netIn) }],
        networkOut: [{ Timestamp: now, Average: Math.round(netOut) }],
        diskRead: [{ Timestamp: now, Average: 0 }],
        diskWrite: [{ Timestamp: now, Average: 0 }],
        _location: vm.location || "eastus",
      };
    } catch (e) {
      const now = new Date();
      return {
        instanceId: vm.id,
        instanceType: "vm",
        cpu: [{ Timestamp: now, Average: 0 }],
        networkIn: [{ Timestamp: now, Average: 0 }],
        networkOut: [{ Timestamp: now, Average: 0 }],
        diskRead: [{ Timestamp: now, Average: 0 }],
        diskWrite: [{ Timestamp: now, Average: 0 }],
        _location: vm.location || "eastus",
        _error: e.message,
      };
    }
  }

  if (vms.length) {
    for (let i = 0; i < vms.length; i += concurrency) {
      const batch = vms.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((vm) => queryVmMetrics(vm)));
      instances.push(...results);
    }
  }

  const totalInstances = instances.length;
  const avgCPU = totalInstances
    ? Math.round(
        (instances.reduce((s, inst) => s + (inst.cpu?.[0]?.Average || 0), 0) / totalInstances) *
          10
      ) / 10
    : 0;
  const totalNetworkIn = Math.round(
    instances.reduce((s, inst) => s + (inst.networkIn?.[0]?.Average || 0), 0)
  );
  const totalNetworkOut = Math.round(
    instances.reduce((s, inst) => s + (inst.networkOut?.[0]?.Average || 0), 0)
  );

  // Prefer region from first instance if present
  const region = instances.find((x) => x._location)?.
    _location || "eastus";

  return {
    totalInstances,
    instances,
    summary: { avgCPU, totalNetworkIn, totalNetworkOut },
    region,
    capturedAt: new Date(),
  };
}

export async function ingestAzureMetricsForAllUsers() {
  const metrics = await fetchAzureInstancesMetrics();
  if (!metrics) return;

  latestGlobalAzureSnapshot = metrics;
  lastGlobalAzureSnapshotAt = new Date();

  try {
    const users = await User.find({}, "_id");
    const saveResults = await Promise.all(
      users.map(async (u) => {
        const doc = new CloudMetrics({
          userId: u._id,
          provider: "azure",
          metrics: {
            totalInstances: metrics.totalInstances,
            instances: metrics.instances,
            summary: metrics.summary,
          },
          carbonFootprint: 0, // will be auto-calculated in pre-save if possible
          cost: 0, // synthetic; can be replaced with Azure Cost Management integration later
          region: metrics.region || "eastus",
          dataSource: "azure-monitor",
          timestamp: new Date(),
        });
        await doc.save();

        // Upsert monthly CarbonFootprint summary (simple synthetic approach)
        try {
          const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
          const activeInstances = metrics.totalInstances;
          const avgCPU = Number(metrics.summary?.avgCPU) || 0;
          const totalEmissions = Number((activeInstances * avgCPU * 0.10).toFixed(2));
          const costEstimate = Number((activeInstances * (0.02 + avgCPU * 0.00009)).toFixed(2));
          const efficiencyScore = Math.max(10, Math.min(100, Math.round(110 - avgCPU)));

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
          console.warn("Azure CarbonFootprint upsert failed:", aggErr.message);
        }

        // Realtime emit for users
        emitToUser(u._id.toString(), "cloud:azure:instances", {
          success: true,
          type: "ingest",
          timestamp: new Date().toISOString(),
          totalInstances: metrics.totalInstances,
          avgCPU: metrics.summary.avgCPU,
        });
        return doc._id;
      })
    );
    console.log(`✅ Azure metrics ingested for ${users.length} users (docs: ${saveResults.length})`);
  } catch (e) {
    console.error("Ingest Azure metrics error:", e.message);
  }
}

export function startAzureMetricsScheduler() {
  const intervalMs = parseInt(process.env.AZURE_METRICS_INTERVAL_MS || "300000", 10); // default 5m
  setInterval(() => {
    ingestAzureMetricsForAllUsers();
  }, intervalMs);
  // Initial warm start
  ingestAzureMetricsForAllUsers();
  console.log(`⏱️ Azure metrics scheduler started (interval ${intervalMs / 1000}s)`);
}

export function getLatestGlobalAzureSnapshot() {
  return { snapshot: latestGlobalAzureSnapshot, at: lastGlobalAzureSnapshotAt };
}
