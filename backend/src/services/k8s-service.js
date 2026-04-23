import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import os from 'os';
import K8sCluster from '../models/K8sCluster.js';
import * as k8s from '@kubernetes/client-node';

function mockInventory(provider) {
  // Simulated minimal inventory; replace with real Kubernetes API integration later
  const ns = ['default','prod','staging'];
  const rand = (min,max)=> Math.round(min + Math.random()*(max-min));
  const pods = Array.from({length: rand(8,18)}).map((_,i)=>({ name:`pod-${i}`, namespace: ns[i%ns.length], status: ['Running','Pending','CrashLoopBackOff'][i%3], cpu: rand(5,80), memory: rand(50,900) }));
  const services = Array.from({length: rand(3,7)}).map((_,i)=>({ name:`svc-${i}`, namespace: ns[i%ns.length], type: ['ClusterIP','LoadBalancer','NodePort'][i%3] }));
  const nodes = Array.from({length: rand(2,5)}).map((_,i)=>({ name:`node-${i}`, role: i===0?'master':'worker', cpuCapacity: 4000, cpuUsed: rand(500,3200), memCapacity: 16384, memUsed: rand(1024,14000) }));
  const namespaces = ns.map(n=>({ name:n, costMonthly: rand(20,120), cpuAvg: rand(5,70), memAvg: rand(50,900) }));
  return { pods, services, nodes, namespaces, provider };
}

export async function listClusters(userId) {
  const uid = new mongoose.Types.ObjectId(userId);
  const clusters = await K8sCluster.find({ userId: uid }).lean();
  return clusters;
}

export async function ensureDemoClusters(userId) {
  const uid = new mongoose.Types.ObjectId(userId);
  const existing = await K8sCluster.find({ userId: uid }).countDocuments();
  if (existing === 0) {
    await K8sCluster.insertMany([
      { userId: uid, provider: 'aws', name: 'eks-demo', connected: true, lastSeen: new Date() },
      { userId: uid, provider: 'azure', name: 'aks-demo', connected: true, lastSeen: new Date() },
      { userId: uid, provider: 'gcp', name: 'gke-demo', connected: true, lastSeen: new Date() },
    ]);
  }
}

export async function getClusterInventory(userId, provider) {
  await ensureDemoClusters(userId);
  // Try real cluster first
  const uid = new mongoose.Types.ObjectId(userId);
  // Prefer a connected cluster, most recently updated
  const cluster = await K8sCluster.findOne({ userId: uid, provider, connected: true }).sort({ updatedAt: -1 }).lean();
  let inventory;
  try {
    if (cluster?.kubeconfigPath && fs.existsSync(cluster.kubeconfigPath)) {
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(cluster.kubeconfigPath);
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);
      const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

      // Helpers to parse Kubernetes resource quantities
      const parseCpuToMillicores = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val * 1000;
        const s = String(val);
        if (s.endsWith('m')) return parseFloat(s.slice(0, -1)) || 0;
        const cores = parseFloat(s);
        return isNaN(cores) ? 0 : Math.round(cores * 1000);
      };
      const parseMemToMB = (val) => {
        if (!val) return 0;
        const s = String(val);
        const num = parseFloat(s);
        if (isNaN(num)) return 0;
        if (/Ki$/i.test(s)) return Math.round((num * 1024) / (1024 * 1024)); // Ki -> bytes -> MB
        if (/Mi$/i.test(s)) return Math.round(num); // Mi ~ MB
        if (/Gi$/i.test(s)) return Math.round(num * 1024);
        if (/Ti$/i.test(s)) return Math.round(num * 1024 * 1024);
        if (/^\d+$/.test(s)) return Math.round(num / (1024 * 1024)); // assume bytes
        return 0;
      };

      const [podsRes, svcsRes, nodesRes] = await Promise.all([
        coreApi.listPodForAllNamespaces(),
        coreApi.listServiceForAllNamespaces(),
        coreApi.listNode(),
      ]);

      // Base objects
      const pods = podsRes.body.items.map((p)=>({
        name: p.metadata?.name,
        namespace: p.metadata?.namespace,
        nodeName: p.spec?.nodeName,
        status: p.status?.phase,
        cpu: 0,
        memory: 0,
      }));
      const services = svcsRes.body.items.map((s)=>({
        name: s.metadata?.name,
        namespace: s.metadata?.namespace,
        type: s.spec?.type || 'ClusterIP',
      }));
      const nodes = nodesRes.body.items.map((n)=>{
        const labels = n.metadata?.labels || {};
        const isControlPlane = labels['node-role.kubernetes.io/control-plane'] !== undefined || labels['node-role.kubernetes.io/master'] !== undefined;
        const role = isControlPlane ? 'master' : 'worker';
        const cpuCapacity = parseCpuToMillicores(n.status?.capacity?.cpu || 0);
        const memCapacity = parseMemToMB(n.status?.capacity?.memory || '0');
        return {
          name: n.metadata?.name,
          role,
          cpuCapacity,
          cpuUsed: 0,
          memCapacity,
          memUsed: 0,
        };
      });

      // Try Metrics API for real-time usage
      try {
        const [nodeMetricsRes, podMetricsRes] = await Promise.all([
          customApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes'),
          customApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'pods'),
        ]);
        const nodeMetricsItems = (nodeMetricsRes?.body?.items || []);
        const podMetricsItems = (podMetricsRes?.body?.items || []);

        const nodeUsageMap = new Map();
        for (const item of nodeMetricsItems) {
          const name = item?.metadata?.name;
          const usage = item?.usage || {};
          const cpuUsed = parseCpuToMillicores(usage.cpu);
          const memUsed = parseMemToMB(usage.memory);
          nodeUsageMap.set(name, { cpuUsed, memUsed });
        }
        // Attach node usage
        for (const n of nodes) {
          const usage = nodeUsageMap.get(n.name);
          if (usage) {
            n.cpuUsed = usage.cpuUsed;
            n.memUsed = usage.memUsed;
          }
        }

        // Pod metrics: sum container usage per pod
        const podUsageMap = new Map();
        for (const item of podMetricsItems) {
          const ns = item?.metadata?.namespace;
          const name = item?.metadata?.name;
          const containers = item?.containers || [];
          let mCpu = 0;
          let mMemMB = 0;
          for (const c of containers) {
            mCpu += parseCpuToMillicores(c?.usage?.cpu);
            mMemMB += parseMemToMB(c?.usage?.memory);
          }
          podUsageMap.set(`${ns}/${name}`, { mCpu, mMemMB });
        }
        for (const p of pods) {
          const key = `${p.namespace}/${p.name}`;
          const u = podUsageMap.get(key);
          if (u) {
            // Present CPU roughly as percentage of 1 vCPU (1000m)
            p.cpu = Math.min(999, Math.round(u.mCpu / 10));
            p.memory = u.mMemMB; // MB
          }
        }
      } catch (metricsErr) {
        // Metrics API not installed or inaccessible; keep zeros
      }

      // Namespace rollups from pods
      const nsMap = new Map();
      for (const p of pods) {
        const rec = nsMap.get(p.namespace) || { name: p.namespace, costMonthly: 0, cpuAvg: 0, memAvg: 0, _cnt: 0, _cpuSum: 0, _memSum: 0 };
        rec._cnt += 1;
        rec._cpuSum += p.cpu || 0;
        rec._memSum += p.memory || 0;
        nsMap.set(p.namespace, rec);
      }
      const namespaces = Array.from(nsMap.values()).map(r => ({
        name: r.name,
        costMonthly: 0, // TODO: integrate Kubecost/billing
        cpuAvg: r._cnt ? Math.round(r._cpuSum / r._cnt) : 0,
        memAvg: r._cnt ? Math.round(r._memSum / r._cnt) : 0,
      }));

      inventory = { pods, services, nodes, namespaces, provider };
    } else {
      inventory = mockInventory(provider);
    }
  } catch (e) {
    console.warn('k8s inventory fallback to mock:', e.message);
    inventory = mockInventory(provider);
  }
  // Simple rollups
  const totalCost = inventory.namespaces.reduce((s,n)=> s+(n.costMonthly||0), 0);
  const avgCpu = inventory.nodes.length ? Math.round(
    inventory.nodes.reduce((s,n)=> s + (n.cpuCapacity ? (n.cpuUsed / n.cpuCapacity) : 0), 0) / inventory.nodes.length * 100
  ) : 0;
  const avgMem = inventory.nodes.length ? Math.round(
    inventory.nodes.reduce((s,n)=> s + (n.memCapacity ? (n.memUsed / n.memCapacity) : 0), 0) / inventory.nodes.length * 100
  ) : 0;
  return { ...inventory, summary: { totalCost, avgCpu, avgMem } };
}

export async function getProviderPods(userId, provider) {
  const inv = await getClusterInventory(userId, provider);
  return inv.pods || [];
}

export async function connectCluster(userId, { provider, name, kubeconfigContent }) {
  const uid = new mongoose.Types.ObjectId(userId);
  if (!['aws','azure','gcp'].includes(provider)) throw new Error('Invalid provider');
  const dir = path.join(os.tmpdir(), 'greenvision-kube');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${uid}-${provider}-${Date.now()}.kubeconfig`);
  fs.writeFileSync(file, kubeconfigContent, 'utf8');
  const cluster = await K8sCluster.findOneAndUpdate(
    { userId: uid, provider, name },
    { kubeconfigPath: file, connected: true, lastSeen: new Date() },
    { upsert: true, new: true }
  );
  return cluster;
}
