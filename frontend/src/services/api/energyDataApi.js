import apiClient from '../utils/apiClient';

export const energyDataApi = {
  create: async (data) => apiClient.post('/energy-data', data).then(res => res.data),
  getAll: async () => apiClient.get('/energy-data').then(res => res.data),
  getById: async (id) => apiClient.get(`/energy-data/${id}`).then(res => res.data),
  update: async (id, data) => apiClient.put(`/energy-data/${id}`, data).then(res => res.data),
  delete: async (id) => apiClient.delete(`/energy-data/${id}`).then(res => res.data),
  getSummary: async () => apiClient.get('/energy-data/summary').then(res => res.data)
};
