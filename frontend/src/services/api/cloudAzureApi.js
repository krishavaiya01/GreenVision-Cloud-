import apiClient from './apiClient';

export const cloudAzureApi = {
  getIssueLogs: (params = {}) => apiClient.get('/cloud/azure/logs/issues', { params }),
  getCombinedIssueLogs: (params = {}) => apiClient.get('/cloud/logs/issues', { params: { provider: 'azure', ...params } }),
  diag: () => apiClient.get('/cloud/azure/logs/diag'),
  getSummary: (params = {}) => apiClient.get('/cloud/azure/logs/summary', { params }),
  getResources: () => apiClient.get('/cloud/azure/resources'),
};

export default cloudAzureApi;
