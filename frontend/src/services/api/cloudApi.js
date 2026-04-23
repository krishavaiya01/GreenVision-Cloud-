// src/services/api/cloudApi.js
import apiClient from "./apiClient";

export const cloudApi = {
  getAwsMetrics: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/cloud/aws/metrics?${query}`).then(res => res.data);
  },

  // Latest normalized AWS instances for the authenticated user
  getAwsInstances: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/cloud/aws/instances?${query}`).then(res => res.data);
  },

  getDashboard: async () => 
    apiClient.get("/cloud/dashboard").then(res => res.data),

  getCarbonFootprint: async () => 
    apiClient.get("/cloud/carbon").then(res => res.data),

  getCarbonTrends: async (months = 6) => 
    apiClient.get(`/cloud/carbon/trends?months=${months}`).then(res => res.data),

  getCloudProviderData: async () => {
    try {
      const response = await apiClient.get("/cloud/providers");
      return response.data;
    } catch (error) {
      console.error("Error fetching cloud provider data:", error);
      throw error;
    }
  },
};
