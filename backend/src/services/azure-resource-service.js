import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { WebSiteManagementClient } from "@azure/arm-appservice";
import { StorageManagementClient } from "@azure/arm-storage";

function getAzureCredential() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (tenantId && clientId && clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  // Fallback to DefaultAzureCredential for local dev/managed identity
  return new DefaultAzureCredential();
}

async function listResourceGroups() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) throw new Error("AZURE_SUBSCRIPTION_ID is required");
  const credential = getAzureCredential();
  const client = new ResourceManagementClient(credential, subscriptionId);
  const groups = [];
  for await (const rg of client.resourceGroups.list()) {
    groups.push({
      id: rg.id,
      name: rg.name,
      location: rg.location,
      tags: rg.tags || {},
      managedBy: rg.managedBy || null,
      properties: {
        provisioningState: rg.properties?.provisioningState || null,
      },
    });
  }
  return groups;
}

async function listWebApps() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) throw new Error("AZURE_SUBSCRIPTION_ID is required");
  const credential = getAzureCredential();
  const siteClient = new WebSiteManagementClient(credential, subscriptionId);
  const apps = [];
  for await (const app of siteClient.webApps.list()) {
    apps.push({
      id: app.id,
      name: app.name,
      kind: app.kind,
      state: app.state,
      enabledHostNames: app.enabledHostNames || [],
      defaultHostName: app.defaultHostName || null,
      resourceGroup: app.resourceGroup || (app.id?.split("/resourceGroups/")[1]?.split("/")[0] || null),
      location: app.location,
      httpsOnly: app.httpsOnly,
      clientAffinityEnabled: app.clientAffinityEnabled,
      reserved: app.reserved,
      scmSiteAlsoStopped: app.scmSiteAlsoStopped,
      dailyMemoryTimeQuota: app.dailyMemoryTimeQuota,
      tags: app.tags || {},
    });
  }
  return apps;
}

async function listAppServicePlans() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) throw new Error("AZURE_SUBSCRIPTION_ID is required");
  const credential = getAzureCredential();
  const siteClient = new WebSiteManagementClient(credential, subscriptionId);
  const plans = [];
  for await (const p of siteClient.appServicePlans.list()) {
    plans.push({
      id: p.id,
      name: p.name,
      resourceGroup: p.resourceGroup || (p.id?.split("/resourceGroups/")[1]?.split("/")[0] || null),
      location: p.location,
      sku: p.sku ? { name: p.sku.name, tier: p.sku.tier, size: p.sku.size, capacity: p.sku.capacity } : null,
      kind: p.kind,
      reserved: p.reserved,
      perSiteScaling: p.perSiteScaling,
      maximumNumberOfWorkers: p.maximumNumberOfWorkers,
      tags: p.tags || {},
    });
  }
  return plans;
}

async function listStorageAccounts() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) throw new Error("AZURE_SUBSCRIPTION_ID is required");
  const credential = getAzureCredential();
  const storageClient = new StorageManagementClient(credential, subscriptionId);
  const accounts = [];
  for await (const sa of storageClient.storageAccounts.list()) {
    accounts.push({
      id: sa.id,
      name: sa.name,
      resourceGroup: sa.resourceGroup || (sa.id?.split("/resourceGroups/")[1]?.split("/")[0] || null),
      location: sa.location,
      kind: sa.kind,
      sku: sa.sku ? { name: sa.sku.name, tier: sa.sku.tier } : null,
      primaryEndpoints: sa.primaryEndpoints || {},
      enableHttpsTrafficOnly: sa.enableHttpsTrafficOnly,
      minimumTlsVersion: sa.minimumTlsVersion,
      tags: sa.tags || {},
    });
  }
  return accounts;
}

function portalUrlFromResourceId(resourceId) {
  // https://portal.azure.com/#@{tenant}/resource{resourceId}
  // Avoid tenant scoping to keep it simple:
  return `https://portal.azure.com/#@/resource${resourceId}`;
}

async function getInventory() {
  const [resourceGroups, webApps, appServicePlans, storageAccounts] = await Promise.all([
    listResourceGroups().catch((e) => ({ error: e.message, items: [] })),
    listWebApps().catch((e) => ({ error: e.message, items: [] })),
    listAppServicePlans().catch((e) => ({ error: e.message, items: [] })),
    listStorageAccounts().catch((e) => ({ error: e.message, items: [] })),
  ]);

  const normalize = (x) => (Array.isArray(x) ? x : x.items || []);
  const rgs = normalize(resourceGroups);
  const apps = normalize(webApps);
  const plans = normalize(appServicePlans);
  const sas = normalize(storageAccounts);

  return {
    resourceGroups: rgs,
    webApps: apps,
    appServicePlans: plans,
    storageAccounts: sas,
    counts: {
      resourceGroups: rgs.length,
      webApps: apps.length,
      appServicePlans: plans.length,
      storageAccounts: sas.length,
    },
    errors: {
      resourceGroups: Array.isArray(resourceGroups) ? null : resourceGroups.error,
      webApps: Array.isArray(webApps) ? null : webApps.error,
      appServicePlans: Array.isArray(appServicePlans) ? null : appServicePlans.error,
      storageAccounts: Array.isArray(storageAccounts) ? null : storageAccounts.error,
    },
    portal: { portalUrlFromResourceId },
  };
}

export default {
  listResourceGroups,
  listWebApps,
  listAppServicePlans,
  listStorageAccounts,
  getInventory,
  portalUrlFromResourceId,
};
