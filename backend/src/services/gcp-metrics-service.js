import CloudMetrics from "../models/CloudMetrics.js";
import User from "../models/User.js";
import gcpResources from "./gcp-resource-service.js";

// Minimal GCP metrics ingestion: counts GCE instances and writes CloudMetrics.
// Optional: SIMULATE_GCP_METRICS=true to generate a synthetic avgCPU value.

async function fetchGcpMetricsSnapshot() {
  try {
    const instances = await gcpResources.listComputeInstances();
    const totalInstances = Array.isArray(instances) ? instances.length : 0;
    const simulate = String(process.env.SIMULATE_GCP_METRICS || 'false').toLowerCase() === 'true';
    const avgCPU = simulate && totalInstances > 0 ? Math.round((20 + Math.random() * 40) * 10) / 10 : 0; // 20-60%

    const metrics = {
      totalInstances,
      instances: (instances || []).slice(0, 20).map(vm => ({
        instanceId: vm.id || vm.name,
        instanceType: vm.machineType || 'n1-standard',
        cpu: [{ Timestamp: new Date(), Average: avgCPU }],
        networkIn: [{ Timestamp: new Date(), Average: 0 }],
        networkOut: [{ Timestamp: new Date(), Average: 0 }],
        diskRead: [{ Timestamp: new Date(), Average: 0 }],
        diskWrite: [{ Timestamp: new Date(), Average: 0 }],
      })),
      summary: { avgCPU, totalNetworkIn: 0, totalNetworkOut: 0 }
    };
    return metrics;
  } catch (err) {
    console.warn("GCP metrics fetch failed:", err.message);
    const simulate = String(process.env.SIMULATE_GCP_METRICS || 'false').toLowerCase() === 'true';
    if (simulate) {
      const totalInstances = Math.floor(1 + Math.random() * 4); // 1-4 synthetic instances
      const avgCPU = Math.round((20 + Math.random() * 40) * 10) / 10;
      return {
        totalInstances,
        instances: Array.from({ length: Math.min(3, totalInstances) }).map((_, i) => ({
          instanceId: `sim-gcp-${i+1}`,
          instanceType: 'e2-medium',
          cpu: [{ Timestamp: new Date(), Average: avgCPU }],
          networkIn: [{ Timestamp: new Date(), Average: 0 }],
          networkOut: [{ Timestamp: new Date(), Average: 0 }],
          diskRead: [{ Timestamp: new Date(), Average: 0 }],
          diskWrite: [{ Timestamp: new Date(), Average: 0 }],
        })),
        summary: { avgCPU, totalNetworkIn: 0, totalNetworkOut: 0 }
      };
    }
    return null;
  }
}

export async function ingestGcpMetricsForAllUsers() {
  const metrics = await fetchGcpMetricsSnapshot();
  if (!metrics) return;
  try {
    const users = await User.find({}, "_id");
    if (!users.length) return;
    await Promise.all(users.map(async (u) => {
      const doc = new CloudMetrics({
        userId: u._id,
        provider: "gcp",
        metrics,
        carbonFootprint: 0,
        cost: 0,
        region: process.env.GCP_REGION || "global",
        dataSource: "gcp-monitoring",
      });
      await doc.save();
    }));
    console.log(`✅ GCP metrics ingested for ${users.length} users (instances: ${metrics.totalInstances})`);
  } catch (e) {
    console.error("Ingest GCP metrics error:", e.message);
  }
}

export function startGcpMetricsScheduler() {
  const intervalMs = parseInt(process.env.GCP_METRICS_INTERVAL_MS || "300000", 10); // default 5m
  setInterval(() => {
    ingestGcpMetricsForAllUsers();
  }, intervalMs);
  // Initial run
  ingestGcpMetricsForAllUsers();
  console.log(`⏱️ GCP metrics scheduler started (interval ${intervalMs / 1000}s)`);
}

export default {
  startGcpMetricsScheduler,
  ingestGcpMetricsForAllUsers,
};
