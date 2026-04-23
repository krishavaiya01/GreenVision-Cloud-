import mongoose from 'mongoose';
import CarbonEmissionEvent from '../models/CarbonEmissionEvent.js';

const BYTES_PER_GB = 1024 ** 3;

function getProviderIntensity(provider) {
  const map = {
    aws: parseFloat(process.env.CARBON_INTENSITY_AWS || '0.45'),
    azure: parseFloat(process.env.CARBON_INTENSITY_AZURE || '0.42'),
    gcp: parseFloat(process.env.CARBON_INTENSITY_GCP || '0.40')
  };
  return map[provider] ?? 0.45;
}

function getPricePerGB() {
  return parseFloat(process.env.LOG_STORAGE_PRICE_PER_GB || '0.50');
}

function getKWhPerGB() {
  return parseFloat(process.env.LOG_STORAGE_KWH_PER_GB || '0.5');
}

class CarbonEmissionService {
  async recordLogWindowEmission({ userId = null, provider, bytesIngested, windowStart, windowEnd, logCount }) {
    if (!provider) throw new Error('provider required');
    if (!windowStart || !windowEnd) throw new Error('windowStart/windowEnd required');
    if (!bytesIngested || bytesIngested <= 0) return null; // skip empty windows

    const gb = bytesIngested / BYTES_PER_GB;
    const kWhPerGB = getKWhPerGB();
    const estimatedKWh = gb * kWhPerGB;
    const intensity = getProviderIntensity(provider);
    const estimatedCO2Kg = estimatedKWh * intensity; // kg CO2
    const pricePerGB = getPricePerGB();
    const estimatedCost = gb * pricePerGB;

    const doc = await CarbonEmissionEvent.create({
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      provider,
      source: 'logs',
      bytesIngested,
      estimatedKWh: Number(estimatedKWh.toFixed(6)),
      estimatedCO2Kg: Number(estimatedCO2Kg.toFixed(6)),
      estimatedCost: Number(estimatedCost.toFixed(6)),
      windowStart,
      windowEnd
    });
    return doc;
  }

  // Simple simulation to create synthetic provider events (used until real ingestion added)
  async simulateProviderWindow({ userId = null, provider, factor = 1 }) {
    const now = Date.now();
    const windowEnd = new Date(Math.floor(now / 60000) * 60000);
    const windowStart = new Date(windowEnd.getTime() - 60000);
    // Generate pseudo-random bytes in a bounded range scaled by factor
    const base = 50_000 + Math.floor(Math.random() * 150_000); // 50KB - 200KB
    const bytes = Math.round(base * factor);
    return this.recordLogWindowEmission({ userId, provider, bytesIngested: bytes, windowStart, windowEnd });
  }

  async maybeSimulateAdditionalProviders() {
    // Controlled by env flags SIMULATE_AZURE_LOGS / SIMULATE_GCP_LOGS
    const simulateAzure = String(process.env.SIMULATE_AZURE_LOGS || 'false').toLowerCase() === 'true';
    const simulateGcp = String(process.env.SIMULATE_GCP_LOGS || 'false').toLowerCase() === 'true';
    const promises = [];
    if (simulateAzure) promises.push(this.simulateProviderWindow({ provider: 'azure', factor: 1.2 }));
    if (simulateGcp) promises.push(this.simulateProviderWindow({ provider: 'gcp', factor: 0.9 }));
    if (promises.length) {
      try { await Promise.all(promises); } catch (e) { console.warn('simulate:provider-failed', e.message); }
    }
  }

  async getRealtimeEmissions({ userId, sinceMinutes = 60 }) {
    const minutes = Math.max(1, parseInt(sinceMinutes, 10) || 60);
    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60 * 1000);
    // Determine bucket size: aim for <= 60 points. For 60m use 1m, 240m -> 4m etc.
    const desiredBuckets = 60;
    const rawBucketMs = (minutes * 60 * 1000) / desiredBuckets;
    // Round bucket to nearest whole minute (>=60s). Minimum 60000ms.
    const bucketMs = Math.max(60000, Math.round(rawBucketMs / 60000) * 60000);

    const match = { windowEnd: { $gte: from, $lte: to } };
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      match.$or = [{ userId: userObjectId }, { userId: null }];
    } catch (_) {
      match.userId = null;
    }

    // Aggregation for totals per provider
    const agg = await CarbonEmissionEvent.aggregate([
      { $match: match },
      { $group: {
          _id: '$provider',
          bytes: { $sum: '$bytesIngested' },
          kWh: { $sum: '$estimatedKWh' },
          kgCO2: { $sum: '$estimatedCO2Kg' },
          cost: { $sum: '$estimatedCost' },
          events: { $sum: 1 },
          firstEvent: { $min: '$windowStart' },
          lastEvent: { $max: '$windowEnd' }
        }
      }
    ]);

    // Aggregation for series buckets (provider + bucket start)
    const seriesAgg = await CarbonEmissionEvent.aggregate([
      { $match: match },
      { $project: {
          provider: 1,
          bucketStart: { $toDate: { $subtract: [ { $toLong: '$windowEnd' }, { $mod: [ { $toLong: '$windowEnd' }, bucketMs ] } ] } },
          estimatedCO2Kg: 1
        }
      },
      { $group: {
          _id: { provider: '$provider', bucketStart: '$bucketStart' },
          kgCO2: { $sum: '$estimatedCO2Kg' }
        }
      },
      { $sort: { '_id.bucketStart': 1 } }
    ]);

    // Build provider -> series map
    const seriesMap = {};
    for (const row of seriesAgg) {
      const prov = row._id.provider;
      if (!seriesMap[prov]) seriesMap[prov] = [];
      seriesMap[prov].push({ t: row._id.bucketStart, v: Number(row.kgCO2.toFixed(6)) });
    }

    const providers = agg.map(r => {
      const gb = r.bytes / BYTES_PER_GB;
      const kWh = r.kWh;
      const kgCO2 = r.kgCO2;
      return {
        provider: r._id,
        bytes: r.bytes,
        gb: Number(gb.toFixed(6)),
        kWh: Number(kWh.toFixed(6)),
        kgCO2: Number(kgCO2.toFixed(6)),
        cost: Number(r.cost.toFixed(6)),
        events: r.events,
        firstEvent: r.firstEvent,
        lastEvent: r.lastEvent,
        intensity: {
          kgPerGB: gb > 0 ? Number((kgCO2 / gb).toFixed(6)) : 0,
          kgPerKWh: kWh > 0 ? Number((kgCO2 / kWh).toFixed(6)) : 0
        },
        series: seriesMap[r._id] || []
      };
    }).sort((a,b) => b.kgCO2 - a.kgCO2);

    const totals = providers.reduce((acc,p) => {
      acc.bytes += p.bytes; acc.kWh += p.kWh; acc.kgCO2 += p.kgCO2; acc.cost += p.cost; return acc;
    }, { bytes:0, kWh:0, kgCO2:0, cost:0 });
    const totalGB = totals.bytes / BYTES_PER_GB;
    return {
      range: { sinceMinutes: minutes, from, to, bucketMs },
      providers,
      totals: {
        bytes: totals.bytes,
        gb: Number(totalGB.toFixed(6)),
        kWh: Number(totals.kWh.toFixed(6)),
        kgCO2: Number(totals.kgCO2.toFixed(6)),
        cost: Number(totals.cost.toFixed(6))
      },
      intensity: {
        kgPerGB: totalGB > 0 ? Number((totals.kgCO2 / totalGB).toFixed(6)) : 0,
        kgPerKWh: totals.kWh > 0 ? Number((totals.kgCO2 / totals.kWh).toFixed(6)) : 0
      }
    };
  }
}

export default new CarbonEmissionService();
