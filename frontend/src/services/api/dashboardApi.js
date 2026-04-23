import apiClient from '../utils/apiClient';

export const dashboardApi = {
  // Get overview dashboard data
  getOverview: async (timeRange = '30d') => {
    try {
      const response = await apiClient.get(`/dashboard/overview?timeRange=${timeRange}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dashboard data');
    }
  },

  // Get real-time metrics
  getRealTimeMetrics: async () => {
    try {
      const response = await apiClient.get('/dashboard/realtime');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch real-time metrics');
    }
  },

  // Get usage trends
  getUsageTrends: async (period = '7d', providers = []) => {
    try {
      const params = new URLSearchParams({
        period,
        providers: providers.join(',')
      });
      const response = await apiClient.get(`/dashboard/trends?${params}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch usage trends');
    }
  },

  // Export dashboard report
  exportReport: async (format = 'pdf', dateRange) => {
    try {
      const response = await apiClient.post('/dashboard/export', {
        format,
        dateRange
      }, {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { 
        type: format === 'pdf' ? 'application/pdf' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `greenvision-report-${Date.now()}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      throw new Error('Failed to export report');
    }
  }
};
