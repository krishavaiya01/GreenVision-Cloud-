// simple-data-check.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  console.log('🔍 Checking your existing MongoDB data...');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenvision';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n📁 Your collections:');
    for (let col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
      
      if (count > 0 && count < 5) {
        // Show sample for small collections
        const sample = await db.collection(col.name).findOne();
        console.log(`   Sample from ${col.name}:`, Object.keys(sample));
      }
    }

    console.log('\n🎉 Data check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkData();
