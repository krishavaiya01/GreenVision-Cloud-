import aiRecommendationService from '../services/ai-recommendation-service.js';

export const getRightsizing = async (req, res) => {
  try {
    const userId = req.user?.id;
    const provider = (req.query.provider || 'aws').toLowerCase();

    const result = await aiRecommendationService.getRightsizingRecommendations(userId, provider);
    const recommendations = result.recommendations || [];
    const totalSavings = recommendations.reduce((sum, rec) => sum + (rec.estimatedMonthlySavings || 0), 0);

    return res.json({
      success: true,
      data: recommendations,
      metadata: {
        provider,
        instancesAnalyzed: result.instancesAnalyzed || 0,
        totalEstimatedMonthlySavings: parseFloat(totalSavings.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Rightsizing controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate rightsizing recommendations',
      error: error.message
    });
  }
};

export default { getRightsizing };
