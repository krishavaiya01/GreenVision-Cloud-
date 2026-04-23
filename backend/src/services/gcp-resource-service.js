import { google } from 'googleapis';

// Uses Application Default Credentials (ADC). Ensure one of the following is set up:
// - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON
// - Workload Identity or gcloud auth application-default login on the host

function getProjectId() {
  const pid = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!pid) throw new Error('GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) is required');
  return pid;
}

async function listComputeInstances() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = getProjectId();
  const compute = google.compute('v1');
  const resp = await compute.instances.aggregatedList({ auth, project });
  const instances = [];
  const items = resp.data.items || {};
  for (const [zone, data] of Object.entries(items)) {
    const list = data.instances || [];
    list.forEach((vm) => {
      instances.push({
        id: vm.id,
        name: vm.name,
        status: vm.status,
        machineType: vm.machineType?.split('/').pop(),
        zone: vm.zone?.split('/').pop() || zone,
        labels: vm.labels || {},
        creationTimestamp: vm.creationTimestamp,
        selfLink: vm.selfLink,
      });
    });
  }
  return instances;
}

async function listGkeClusters() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = getProjectId();
  const container = google.container('v1');
  // List across all locations
  const parent = `projects/${project}/locations/-`;
  const resp = await container.projects.locations.clusters.list({ auth, parent });
  const clusters = (resp.data.clusters || []).map((c) => ({
    name: c.name,
    location: c.location,
    status: c.status,
    currentNodeCount: c.currentNodeCount,
    endpoint: c.endpoint,
    releaseChannel: c.releaseChannel?.channel || null,
    selfLink: c.selfLink,
  }));
  return clusters;
}

async function listStorageBuckets() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = getProjectId();
  const storage = google.storage('v1');
  const resp = await storage.buckets.list({ auth, project });
  const buckets = (resp.data.items || []).map((b) => ({
    id: b.id,
    name: b.name,
    location: b.location,
    storageClass: b.storageClass,
    timeCreated: b.timeCreated,
    labels: b.labels || {},
    selfLink: b.selfLink,
  }));
  return buckets;
}

async function listPubSubTopics() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = getProjectId();
  const pubsub = google.pubsub('v1');
  const resp = await pubsub.projects.topics.list({ auth, project: `projects/${project}` });
  return (resp.data.topics || []).map((t) => ({ name: t.name }));
}

async function listPubSubSubscriptions() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = getProjectId();
  const pubsub = google.pubsub('v1');
  const resp = await pubsub.projects.subscriptions.list({ auth, project: `projects/${project}` });
  return (resp.data.subscriptions || []).map((s) => ({ name: s.name, topic: s.topic, ackDeadlineSeconds: s.ackDeadlineSeconds }));
}

async function getInventory() {
  const results = await Promise.all([
    listComputeInstances().catch((e) => ({ error: e.message, items: [] })),
    listGkeClusters().catch((e) => ({ error: e.message, items: [] })),
    listStorageBuckets().catch((e) => ({ error: e.message, items: [] })),
    listPubSubTopics().catch((e) => ({ error: e.message, items: [] })),
    listPubSubSubscriptions().catch((e) => ({ error: e.message, items: [] })),
  ]);

  const norm = (x) => (Array.isArray(x) ? x : x.items || []);
  const [instances, clusters, buckets, topics, subs] = results.map(norm);

  return {
    instances,
    clusters,
    buckets,
    pubsub: { topics, subscriptions: subs },
    counts: {
      instances: instances.length,
      clusters: clusters.length,
      buckets: buckets.length,
      topics: topics.length,
      subscriptions: subs.length,
    },
    errors: {
      instances: Array.isArray(results[0]) ? null : results[0].error,
      clusters: Array.isArray(results[1]) ? null : results[1].error,
      buckets: Array.isArray(results[2]) ? null : results[2].error,
      topics: Array.isArray(results[3]) ? null : results[3].error,
      subscriptions: Array.isArray(results[4]) ? null : results[4].error,
    },
    console: {
      instanceLink: (name, zone) => `https://console.cloud.google.com/compute/instancesDetail/zones/${zone}/instances/${name}?project=${getProjectId()}`,
      bucketLink: (name) => `https://console.cloud.google.com/storage/browser/${encodeURIComponent(name)}?project=${getProjectId()}`,
      clusterLink: (name, location) => `https://console.cloud.google.com/kubernetes/clusters/details/${location}/${name}/details?project=${getProjectId()}`,
      topicLink: (fullName) => `https://console.cloud.google.com/cloudpubsub/topic/detail/${encodeURIComponent(fullName.split('/').pop())}?project=${getProjectId()}`,
      subscriptionLink: (fullName) => `https://console.cloud.google.com/cloudpubsub/subscription/detail/${encodeURIComponent(fullName.split('/').pop())}?project=${getProjectId()}`,
    },
  };
}

export default {
  listComputeInstances,
  listGkeClusters,
  listStorageBuckets,
  listPubSubTopics,
  listPubSubSubscriptions,
  getInventory,
  getProjectId,
};
