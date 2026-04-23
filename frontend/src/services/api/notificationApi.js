// src/services/api/notificationApi.js
import apiClient from './apiClient';

export const notificationApi = {
  sendRecommendationsEmail: async () => apiClient.post('/notifications/ai-recommendations').then(res => res.data),
  sendUrgentAlert: async (payload) => apiClient.post('/notifications/urgent', payload).then(res => res.data),
  getPrefs: async () => apiClient.get('/notifications/prefs').then(res => res.data),
  updatePrefs: async (patch) => apiClient.put('/notifications/prefs', patch).then(res => res.data)
};

export default notificationApi;
