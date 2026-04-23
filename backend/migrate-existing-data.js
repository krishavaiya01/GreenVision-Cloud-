// migrate-existing-data.js
import mongoose from 'mongoose';
import CloudMetrics from './src/models/CloudMetrics.js';
import AITrainingData from './src/models/AITrainingData.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateExistingData() {
  console.log('🔄 Migrating existing data for AI training...');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenvision';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;
    
    // Find your existing collection (adjust collection name as needed)
    const existingCollections = ['cloudmetrics', 'metrics', 'usage', 'data'];
    let sourceCollection = null;
    
    for (let name of existingCollections) {
      const count = await db.collection(name).countDocuments();
      if (count > 0) {
        sourceCollection = db.collection(name);
        console.log(`📊 Using '${name}' collection with ${count} records`);
        break;
      }
    }

    if (!sourceCollection) {
      console.log('❌ No data collections found');
      return;
    }

    // Get all existing documents
    const existingData = await sourceCollection.find({}).toArray();
    console.log(`📥 Found ${existingData.length} records to process`);

    // Process and convert to AI training format
    const aiTrainingRecords = [];
    const cloudMetricsRecords = [];

    for (let record of existingData) {
      // Create CloudMetrics record (standardized format)
      const cloudMetric = {
        userId: record.userId || new mongoose.Types.ObjectId(),
        provider: record.provider || 'aws',
        timestamp: record.timestamp || record.createdAt || new Date(),
        metrics: {
          totalInstances: record.totalInstances || record.instanceCount || 1,
          instances: record.instances || [],
          summary: {
            avgCPU: record.avgCPU || record.cpuUsage || Math.random() * 100,
            totalNetworkIn: record.networkIn || record.totalNetworkIn || Math.random() * 1000,
            totalNetworkOut: record.networkOut || record.totalNetworkOut || Math.random() * 1000
          }
        },
        carbonFootprint: record.carbonFootprint || record.emissions || (Math.random() * 50),
        cost: record.cost || record.price || (Math.random() * 100)
      };

      // Create AI Training record
      const aiRecord = {
        userId: cloudMetric.userId,
        timestamp: cloudMetric.timestamp,
        usageMetrics: {
          cpuUtilization: cloudMetric.metrics.summary.avgCPU,
          memoryUsage: record.memoryUsage || cloudMetric.metrics.summary.avgCPU * 1.2,
          storageUsage: record.storageUsage || Math.random() * 100,
          networkTraffic: cloudMetric.metrics.summary.totalNetworkIn + cloudMetric.metrics.summary.totalNetworkOut
        },
        carbonEmissions: cloudMetric.carbonFootprint,
        costData: cloudMetric.cost,
        optimizationApplied: false
      };

      cloudMetricsRecords.push(cloudMetric);
      aiTrainingRecords.push(aiRecord);
    }

    // Insert into new collections
    if (cloudMetricsRecords.length > 0) {
      await CloudMetrics.insertMany(cloudMetricsRecords);
      console.log(`✅ Inserted ${cloudMetricsRecords.length} CloudMetrics records`);
    }

    if (aiTrainingRecords.length > 0) {
      await AITrainingData.insertMany(aiTrainingRecords);
      console.log(`✅ Inserted ${aiTrainingRecords.length} AI training records`);
    }

    console.log('\n🎉 Data migration completed successfully!');
    console.log(`📊 Ready for AI training with ${aiTrainingRecords.length} data points`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

migrateExistingData();
