import apiClient from './apiClient';

export const complianceApi = {
  getAuditLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/compliance/audit-logs?${query}`).then(res => res.data);
  },

  verifyChain: async () =>
    apiClient.get('/compliance/audit-logs/verify/chain').then(res => res.data),

  exportCSV: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/compliance/audit-logs/export?${query}`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  },

  getStatistics: async () => apiClient.get('/compliance/audit-logs/stats').then(res => res.data),

  getResourceTrail: async (resourceType, resourceId) =>
    apiClient.get(`/compliance/audit-logs/trail/${resourceType}/${resourceId}`).then(res => res.data),
};
