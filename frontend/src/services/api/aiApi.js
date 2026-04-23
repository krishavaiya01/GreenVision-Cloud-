import apiClient from './apiClient';

export const aiApi = {
  getStatus: async () => apiClient.get('/ai/status').then(res => res.data),
  getRecommendations: async () => apiClient.get('/ai/recommendations').then(res => res.data),
  collectData: async (data) => apiClient.post('/ai/collect-data', data).then(res => res.data),
  
  // Anomaly Detection APIs
  getAnomalies: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.provider) params.append('provider', filters.provider);
    if (filters.type) params.append('type', filters.type);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.status) params.append('status', filters.status);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/ai/anomalies${query}`).then(res => res.data);
  },
  
  getActiveAnomalies: async () => apiClient.get('/ai/anomalies/active').then(res => res.data),
  
  detectCostAnomalies: async (provider = 'aws') => 
    apiClient.post('/ai/anomalies/detect/cost', { provider }).then(res => res.data),
  
  detectUtilizationAnomalies: async (provider = 'aws', resourceId = null) => 
    apiClient.post('/ai/anomalies/detect/utilization', { provider, resourceId }).then(res => res.data),
  
  acknowledgeAnomaly: async (anomalyId) => 
    apiClient.patch(`/ai/anomalies/${anomalyId}/acknowledge`).then(res => res.data),
  
  dismissAnomaly: async (anomalyId) => 
    apiClient.patch(`/ai/anomalies/${anomalyId}/dismiss`).then(res => res.data),

  // Rightsizing recommendations
  getRightsizing: async (provider = 'aws') => 
    apiClient.get(`/ai/rightsizing?provider=${provider}`).then(res => res.data)
};
