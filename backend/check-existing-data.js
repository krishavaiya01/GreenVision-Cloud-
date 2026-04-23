// check-existing-data.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkExistingData() {
  console.log('🔍 Checking existing MongoDB data...');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenvision';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📁 Available collections:');
    collections.forEach(col => console.log(`   - ${col.name}`));

    // Check for cloud metrics data
    const db = mongoose.connection.db;
    
    // Check common collection names
    const possibleCollections = ['cloudmetrics', 'metrics', 'usage', 'data', 'clouddata'];
    
    for (let collectionName of possibleCollections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      if (count > 0) {
        console.log(`\n📊 Found ${count} records in '${collectionName}' collection`);
        
        // Show sample document
        const sample = await collection.findOne();
        console.log('📝 Sample document structure:');
        console.log(JSON.stringify(sample, null, 2));
        break;
      }
    }

    // Also check all collections with data
    for (let col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      if (count > 0) {
        console.log(`\n📈 Collection '${col.name}': ${count} documents`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkExistingData();
