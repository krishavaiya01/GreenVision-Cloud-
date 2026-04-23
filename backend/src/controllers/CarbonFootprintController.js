import mongoose from "mongoose";
import CarbonFootprint from "../models/CarbonFootprint.js";
import CarbonEmissionEvent from "../models/CarbonEmissionEvent.js";
import CloudMetrics from "../models/CloudMetrics.js";

// Get latest carbon footprint for logged-in user
export const getUserCarbonFootprint = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { refresh = 'false' } = req.query;
    const monthKey = new Date().toISOString().slice(0,7); // YYYY-MM

    let latest = await CarbonFootprint.findOne({ userId, month: monthKey }).sort({ createdAt: -1 });
    const needsRecalc = !latest || String(refresh).toLowerCase() === 'true';

  if (needsRecalc) {
      // Aggregate this month's emission events
      const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const match = { windowEnd: { $gte: monthStart, $lt: nextMonth } };
      match.$or = [{ userId }, { userId: null }];

      const eventsAgg = await CarbonEmissionEvent.aggregate([
        { $match: match },
        { $group: { _id: null, totalEmissions: { $sum: '$estimatedCO2Kg' }, totalCost: { $sum: '$estimatedCost' } } }
      ]);

      const totalEmissions = eventsAgg.length ? Number(eventsAgg[0].totalEmissions.toFixed(4)) : 0;
      const totalCost = eventsAgg.length ? Number(eventsAgg[0].totalCost.toFixed(4)) : 0;

      // Derive CPU / instances / efficiency from recent CloudMetrics (last 24h)
      const metricsSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metricsAgg = await CloudMetrics.aggregate([
        { $match: { userId, timestamp: { $gte: metricsSince } } },
        { $group: { _id: null, avgCPU: { $avg: '$metrics.summary.avgCPU' }, activeInstances: { $avg: '$metrics.totalInstances' }, efficiency: { $avg: '$carbonFootprint' } } }
      ]);
      const avgCPUUsage = metricsAgg.length ? Number((metricsAgg[0].avgCPU || 0).toFixed(2)) : 0;
      const activeInstances = metricsAgg.length ? Math.round(metricsAgg[0].activeInstances || 0) : 0;
      const efficiencyScore = metricsAgg.length ? Math.round((100 - (metricsAgg[0].efficiency || 0))) : 0; // placeholder heuristic

      // Upsert monthly snapshot
      latest = await CarbonFootprint.findOneAndUpdate(
        { userId, month: monthKey },
        { $set: { totalEmissions, totalCost, avgCPUUsage, activeInstances, efficiencyScore } },
        { new: true, upsert: true }
      );
    }

    // Also compute per-provider monthly breakdown on the fly
    const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const matchProv = { windowEnd: { $gte: monthStart, $lt: nextMonth } };
    matchProv.$or = [{ userId: new mongoose.Types.ObjectId(req.user.id) }, { userId: null }];
    let byProvider = await CarbonEmissionEvent.aggregate([
      { $match: matchProv },
      { $group: { _id: '$provider', kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' }, events: { $sum: 1 } } },
      { $project: { _id: 0, provider: '$_id', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] }, events: 1 } },
      { $sort: { kgCO2: -1 } }
    ]);
    // Augment with recent provider-level metrics (avgCPU, activeInstances) from CloudMetrics in the last 24h
    const metricsSinceProv = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const providerAgg = await CloudMetrics.aggregate([
      { $match: { userId, timestamp: { $gte: metricsSinceProv } } },
      { $group: { _id: '$provider', avgCPU: { $avg: '$metrics.summary.avgCPU' }, activeInstances: { $avg: '$metrics.totalInstances' } } },
      { $project: { _id: 0, provider: '$_id', avgCPU: { $ifNull: [{ $round: ['$avgCPU', 2] }, 0] }, activeInstances: { $ifNull: [{ $round: ['$activeInstances', 0] }, 0] } } }
    ]);
    const provMetricsMap = new Map(providerAgg.map(p => [p.provider, p]));

    // Merge provider metrics into carbon breakdown
    byProvider = byProvider.map(p => {
      const m = provMetricsMap.get(p.provider) || { avgCPU: 0, activeInstances: 0 };
      return { ...p, avgCPU: m.avgCPU || 0, activeInstances: m.activeInstances || 0 };
    });

  // Fill missing providers with zeros so UI always shows AWS, AZURE & GCP
  const want = ['aws','azure','gcp'];
    const have = new Set(byProvider.map(p=>p.provider));
    for (const prov of want) {
      if (!have.has(prov)) {
        const m = provMetricsMap.get(prov) || { avgCPU: 0, activeInstances: 0 };
        byProvider.push({ provider: prov, kgCO2: 0, cost: 0, events: 0, avgCPU: m.avgCPU || 0, activeInstances: m.activeInstances || 0 });
      }
    }
    byProvider.sort((a,b)=> b.kgCO2 - a.kgCO2);

    res.json({ success: true, data: { ...latest.toObject(), breakdownByProvider: byProvider }, recalculated: needsRecalc });
  } catch (error) {
    console.error("CarbonFootprint API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get trends (last N months)
export const getUserCarbonTrends = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months, 10) || 6;

    // Return latest N stored monthly snapshots (we already upsert current month on access)
    const trends = await CarbonFootprint.find({ userId })
      .sort({ month: -1 })
      .limit(months);

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error("CarbonFootprint Trends API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
