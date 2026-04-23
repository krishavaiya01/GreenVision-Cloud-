import apiClient from '../utils/apiClient';

export const predictionApi = {
  create: async (data) => apiClient.post('/predictions', data).then(res => res.data),
  getAll: async () => apiClient.get('/predictions').then(res => res.data),
  getById: async (id) => apiClient.get(`/predictions/${id}`).then(res => res.data),
  update: async (id, data) => apiClient.put(`/predictions/${id}`, data).then(res => res.data),
  delete: async (id) => apiClient.delete(`/predictions/${id}`).then(res => res.data),
  getSummary: async () => apiClient.get('/predictions/summary').then(res => res.data)
};
