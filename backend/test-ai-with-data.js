// test-ai-with-data.js
import mongoose from 'mongoose';
import aiRecommendationService from './src/services/ai-recommendation-service.js';
import aiDataService from './src/services/ai-data-service.js';
import AITrainingData from './src/models/AITrainingData.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAIWithExistingData() {
  console.log('🧠 Testing AI with your existing data...');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenvision';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // Check how much training data we have
    const trainingDataCount = await AITrainingData.countDocuments();
    console.log(`📊 Available AI training data: ${trainingDataCount} records`);

    if (trainingDataCount === 0) {
      console.log('⚠️ No AI training data found. Run migration first.');
      return;
    }

    // Get a sample user ID from the data
    const sampleRecord = await AITrainingData.findOne();
    const userId = sampleRecord.userId;
    console.log(`🔍 Testing with user ID: ${userId}`);

    // Initialize AI model
    await aiRecommendationService.initializeModel();
    console.log('✅ AI model initialized');

    // Generate recommendations using your real data
    const recommendations = await aiRecommendationService.generateRecommendations(userId);
    
    console.log('\n🎯 AI Recommendations based on your data:');
    console.log(`📝 Generated ${recommendations.recommendations.length} recommendations`);
    console.log(`📊 Data source: ${recommendations.dataSource}`);
    console.log(`💬 Message: ${recommendations.message}`);

    // Display recommendations
    recommendations.recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.type.toUpperCase()} Recommendation:`);
      console.log(`   Description: ${rec.description}`);
      console.log(`   Priority: ${rec.priority}`);
      console.log(`   Potential Savings: $${rec.potentialSavings?.toFixed(2) || '0.00'}`);
      console.log(`   Confidence: ${rec.confidence}%`);
    });

    // Get dataset summary
    const dataset = await aiDataService.getTrainingDataset(userId, 10);
    console.log(`\n📈 Dataset Summary:`);
    console.log(`   Features: ${dataset.features.length} data points`);
    console.log(`   Labels: ${dataset.labels.length} data points`);
    
    if (dataset.features.length > 0) {
      const avgCPU = dataset.features.reduce((sum, f) => sum + f[0], 0) / dataset.features.length;
      const avgCost = dataset.labels.reduce((sum, l) => sum + l[1], 0) / dataset.labels.length;
      console.log(`   Average CPU Usage: ${avgCPU.toFixed(1)}%`);
      console.log(`   Average Cost: $${avgCost.toFixed(2)}`);
    }

    console.log('\n🎉 AI system is working with your existing data!');

  } catch (error) {
    console.error('❌ AI test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testAIWithExistingData();
