// src/services/api/cloudGcpApi.js
import apiClient from "./apiClient";

export const cloudGcpApi = {
  getResources: async () => apiClient.get("/cloud/gcp/resources"),
  getLogs: async (params) => apiClient.get(`/cloud/gcp/logs${params ? `?${new URLSearchParams(params)}` : ''}`),
  getIssueLogs: async (params) => apiClient.get(`/cloud/gcp/logs/issues${params ? `?${new URLSearchParams(params)}` : ''}`),
  getDiag: async () => apiClient.get('/cloud/gcp/logs/diag'),
};
