// src/controllers/AiAnomalyController.js
import aiRecommendationService from '../services/ai-recommendation-service.js';

/**
 * Detect cost anomalies for the current user
 * @route POST /api/ai/anomalies/detect/cost
 * @param {string} provider - Cloud provider (aws, azure, gcp)
 */
export const detectCostAnomalies = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { provider = 'aws' } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    console.log('🔍 Detecting cost anomalies for user:', userId, 'provider:', provider);
    
    const result = await aiRecommendationService.detectCostAnomalies(userId, provider);
    
    return res.json({
      success: true,
      data: result.anomalies,
      message: `Found ${result.anomalies.length} cost anomaly/anomalies`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cost anomaly detection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect cost anomalies',
      message: error.message
    });
  }
};

/**
 * Detect utilization anomalies for the current user
 * @route POST /api/ai/anomalies/detect/utilization
 * @param {string} provider - Cloud provider (aws, azure, gcp)
 * @param {string} resourceId - Optional specific resource ID
 */
export const detectUtilizationAnomalies = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { provider = 'aws', resourceId = null } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    console.log('🔍 Detecting utilization anomalies for user:', userId);
    
    const result = await aiRecommendationService.detectUtilizationAnomalies(userId, provider, resourceId);
    
    return res.json({
      success: true,
      data: result.anomalies,
      message: `Found ${result.anomalies.length} utilization anomaly/anomalies`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Utilization anomaly detection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect utilization anomalies',
      message: error.message
    });
  }
};

/**
 * Get all anomalies for the current user
 * @route GET /api/ai/anomalies
 * @query provider - Optional cloud provider filter
 * @query type - Optional anomaly type filter
 * @query severity - Optional severity filter
 * @query status - Optional status filter (active, acknowledged, resolved, dismissed)
 */
export const getAnomalies = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { provider, type, severity, status } = req.query;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    const filters = {};
    if (provider) filters.provider = provider;
    if (type) filters.anomalyType = type;
    if (severity) filters.severity = severity;
    if (status) filters.status = status;

    console.log('📊 Fetching anomalies for user:', userId, 'filters:', filters);
    
    const anomalies = await aiRecommendationService.getAnomalies(userId, filters);
    
    return res.json({
      success: true,
      data: anomalies,
      count: anomalies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching anomalies:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch anomalies',
      message: error.message
    });
  }
};

/**
 * Get active anomalies (summary for dashboard)
 * @route GET /api/ai/anomalies/active
 */
export const getActiveAnomalies = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    const anomalies = await aiRecommendationService.getAnomalies(userId, { status: 'active' });
    
    // Group by severity
    const bySeverity = {
      critical: anomalies.filter(a => a.severity === 'critical'),
      high: anomalies.filter(a => a.severity === 'high'),
      medium: anomalies.filter(a => a.severity === 'medium'),
      low: anomalies.filter(a => a.severity === 'low')
    };

    return res.json({
      success: true,
      data: {
        anomalies,
        bySeverity,
        totalCount: anomalies.length,
        criticalCount: bySeverity.critical.length,
        highCount: bySeverity.high.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching active anomalies:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active anomalies',
      message: error.message
    });
  }
};

/**
 * Acknowledge an anomaly alert
 * @route PATCH /api/ai/anomalies/:anomalyId/acknowledge
 */
export const acknowledgeAnomaly = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { anomalyId } = req.params;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    if (!anomalyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Anomaly ID required' 
      });
    }

    console.log('✅ Acknowledging anomaly:', anomalyId);
    
    const updated = await aiRecommendationService.acknowledgeAnomaly(userId, anomalyId);
    
    return res.json({
      success: true,
      data: updated,
      message: 'Anomaly acknowledged',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error acknowledging anomaly:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to acknowledge anomaly',
      message: error.message
    });
  }
};

/**
 * Dismiss an anomaly alert
 * @route PATCH /api/ai/anomalies/:anomalyId/dismiss
 */
export const dismissAnomaly = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { anomalyId } = req.params;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    if (!anomalyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Anomaly ID required' 
      });
    }

    console.log('🗑️ Dismissing anomaly:', anomalyId);
    
    const updated = await aiRecommendationService.dismissAnomaly(userId, anomalyId);
    
    return res.json({
      success: true,
      data: updated,
      message: 'Anomaly dismissed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error dismissing anomaly:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dismiss anomaly',
      message: error.message
    });
  }
};
