// src/routes/ai.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication to all AI routes
router.use(protect());

// GET /api/ai/status - AI System Health Check
router.get('/status', async (req, res) => {
  try {
    console.log('🎯 AI Status check for user:', req.user.id);
    
    res.json({
      success: true,
      data: {
        modelInitialized: true,
        status: 'ready',
        message: 'AI system is operational',
        userId: req.user.id,
        userRole: req.user.role,
        features: [
          'Rule-based recommendations',
          'Usage pattern analysis', 
          'Cost optimization',
          'Carbon footprint tracking'
        ]
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ AI Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'AI system error',
      message: error.message
    });
  }
});

// GET /api/ai/recommendations - Get AI Recommendations
import aiRecommendationService from '../services/ai-recommendation-service.js';
import AiAssistantController from '../controllers/AiAssistantController.js';
import * as AiAnomalyController from '../controllers/AiAnomalyController.js';
import * as AiRightsizingController from '../controllers/AiRightsizingController.js';

router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🧠 Getting AI recommendations for user:', userId);
  const result = await aiRecommendationService.generateRecommendations(userId);
    res.json({
      success: true,
      data: {
        ...result,
        totalRecommendations: result.recommendations.length,
        potentialMonthlySavings: result.recommendations.reduce((sum, rec) => sum + (rec.potentialSavings || 0), 0),
        userId: userId,
        userRole: req.user.role,
        analysisDate: new Date().toISOString(),
        logSummary: result.logSummary || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ AI Recommendations Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});

// GET /api/ai/rightsizing - Instance-level rightsizing recommendations
router.get('/rightsizing', AiRightsizingController.getRightsizing);

// Anomaly Detection Routes
// GET /api/ai/anomalies - Get all anomalies
router.get('/anomalies', AiAnomalyController.getAnomalies);

// GET /api/ai/anomalies/active - Get active anomalies (dashboard summary)
router.get('/anomalies/active', AiAnomalyController.getActiveAnomalies);

// POST /api/ai/anomalies/detect/cost - Detect cost anomalies
router.post('/anomalies/detect/cost', AiAnomalyController.detectCostAnomalies);

// POST /api/ai/anomalies/detect/utilization - Detect utilization anomalies
router.post('/anomalies/detect/utilization', AiAnomalyController.detectUtilizationAnomalies);

// PATCH /api/ai/anomalies/:anomalyId/acknowledge - Acknowledge anomaly
router.patch('/anomalies/:anomalyId/acknowledge', AiAnomalyController.acknowledgeAnomaly);

// PATCH /api/ai/anomalies/:anomalyId/dismiss - Dismiss anomaly
router.patch('/anomalies/:anomalyId/dismiss', AiAnomalyController.dismissAnomaly);

// POST /api/ai/collect-data - Collect Training Data
router.post('/collect-data', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Collecting AI training data for user:', userId);
    
    res.json({
      success: true,
      data: {
        success: true,
        recordsProcessed: 0,
        message: 'Training data collection initiated (mock response)',
        userId: userId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Data Collection Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect training data',
      message: error.message
    });
  }
});

// AI Assistant routes
// POST /api/ai/assistant/chat -> { message, history? }
router.post('/assistant/chat', AiAssistantController.chat);
// GET /api/ai/assistant/context -> snapshot summary
router.get('/assistant/context', AiAssistantController.getContext);
// POST /api/ai/assistant/email -> send email summary to logged-in user
router.post('/assistant/email', AiAssistantController.emailSummary);
// POST /api/ai/assistant/reset -> reset server-side assistant context (placeholder)
router.post('/assistant/reset', AiAssistantController.reset);

export default router;
