import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/db.js';
import User from '../src/models/User.js';
import CloudMetrics from '../src/models/CloudMetrics.js';

// Quick seeder to backfill cost series for AWS, Azure, and GCP with a deliberate spike
// Usage: MONGO_URI=<uri> node backend/scripts/seedCostSeries.js [userId]

dotenv.config();

async function main() {
  await connectDB();
  const argUser = process.argv[2];
  let user = null;
  if (argUser) {
    user = await User.findById(argUser).lean();
  } else {
    user = await User.findOne().lean();
  }
  if (!user) {
    console.error('No user found. Create a user first or pass userId as arg.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const userId = user._id;

  const now = Date.now();
  const providers = ['aws', 'azure', 'gcp'];
  const docs = [];
  const points = 18; // ~90 minutes if using 5m buckets

  providers.forEach((provider, pIdx) => {
    for (let i = 0; i < points; i++) {
      const ts = new Date(now - (points - i) * 5 * 60 * 1000);
      const base = 2 + pIdx * 0.8; // stagger per provider
      const cost = base * (1 + i * 0.05);
      const isSpike = i === points - 3; // inject spike near the end
      const finalCost = isSpike ? cost * 4.5 : cost;
      docs.push({
        userId,
        provider,
        timestamp: ts,
        metrics: {
          totalInstances: 3 + pIdx,
          instances: [
            {
              instanceId: `${provider}-i-${i}`,
              instanceType: isSpike ? 'g4dn.xlarge' : 't3.medium',
              cpu: [{ Timestamp: ts, Average: isSpike ? 82 : 45 + i }],
              networkIn: [{ Timestamp: ts, Average: 1000 + i * 5 }],
              networkOut: [{ Timestamp: ts, Average: 1500 + i * 4 }],
              diskRead: [{ Timestamp: ts, Average: 200 + i * 2 }],
              diskWrite: [{ Timestamp: ts, Average: 180 + i * 2 }],
            },
          ],
          summary: {
            avgCPU: isSpike ? 78 : 52 + i * 0.4,
            totalNetworkIn: 1000 + i * 5,
            totalNetworkOut: 1500 + i * 4,
          },
        },
        carbonFootprint: Math.round((finalCost * 0.42 + i * 0.1) * 100) / 100,
        cost: Math.round(finalCost * 100) / 100,
        currency: 'USD',
        region: provider === 'aws' ? 'us-east-1' : provider === 'azure' ? 'eastus' : 'us-central1',
        isActive: true,
        dataSource: provider === 'aws' ? 'cloudwatch' : provider === 'azure' ? 'azure-monitor' : 'gcp-monitoring',
      });
    }
  });

  await CloudMetrics.deleteMany({ userId });
  await CloudMetrics.insertMany(docs);
  console.log(`Inserted ${docs.length} CloudMetrics docs for user ${userId}`);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
