// src/services/ai-data-service.js
import CloudMetrics from '../models/CloudMetrics.js';
import AITrainingData from '../models/AITrainingData.js';

class AIDataService {
  async collectTrainingData(userId) {
    console.log('📊 Collecting training data for user:', userId);
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      
      const metricsData = await CloudMetrics.find({
        userId: userId,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 });

      if (metricsData.length === 0) {
        return {
          success: false,
          message: 'No cloud metrics data found'
        };
      }

      const trainingDataPromises = metricsData.map(metric => 
        this.processMetricForTraining(metric)
      );
      
      const trainingData = await Promise.all(trainingDataPromises);
      const validData = trainingData.filter(data => data !== null);
      
      if (validData.length > 0) {
        await AITrainingData.insertMany(validData);
      }
      
      return {
        success: true,
        recordsProcessed: validData.length,
        message: `Training data collected: ${validData.length} records`
      };
      
    } catch (error) {
      console.error('Data collection error:', error);
      throw error;
    }
  }

  async processMetricForTraining(cloudMetric) {
    try {
      const avgCPU = cloudMetric.metrics?.summary?.avgCPU || 0;
      const networkTraffic = (
        (cloudMetric.metrics?.summary?.totalNetworkIn || 0) + 
        (cloudMetric.metrics?.summary?.totalNetworkOut || 0)
      );
      
      if (avgCPU === 0 && networkTraffic === 0) return null;
      
      return {
        userId: cloudMetric.userId,
        timestamp: cloudMetric.timestamp,
        usageMetrics: {
          cpuUtilization: avgCPU,
          memoryUsage: Math.min(avgCPU * 1.2, 100),
          storageUsage: Math.random() * 100,
          networkTraffic: networkTraffic
        },
        carbonEmissions: cloudMetric.carbonFootprint || 0,
        costData: cloudMetric.cost || 0,
        optimizationApplied: false
      };
      
    } catch (error) {
      console.error('Error processing metric:', error);
      return null;
    }
  }

  async getTrainingDataset(userId, limit = 1000) {
    const data = await AITrainingData.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return {
      features: data.map(d => [
        d.usageMetrics.cpuUtilization,
        d.usageMetrics.memoryUsage,
        d.usageMetrics.storageUsage,
        d.usageMetrics.networkTraffic
      ]),
      labels: data.map(d => [
        d.carbonEmissions,
        d.costData
      ])
    };
  }
}

export default new AIDataService();
