import apiClient from '../../utils/apiClient';

export const cloudMetricApi = {
  create: async (data) => apiClient.post('/api/cloudmetrics', data).then(res => res.data),
  getAll: async () => apiClient.get('/api/cloudmetrics').then(res => res.data),
  getById: async (id) => apiClient.get(`/api/cloudmetrics/${id}`).then(res => res.data),
  update: async (id, data) => apiClient.put(`/api/cloudmetrics/${id}`, data).then(res => res.data),
  delete: async (id) => apiClient.delete(`/api/cloudmetrics/${id}`).then(res => res.data),
  getCostSeries: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return apiClient.get(`/api/cloudmetrics/cost-series${suffix}`).then(res => res.data);
  },
  getSummary: async () => apiClient.get('/api/cloudmetrics/summary').then(res => res.data),
  getAllAdmin: async () => apiClient.get('/api/cloudmetrics/admin/all').then(res => res.data)
};
