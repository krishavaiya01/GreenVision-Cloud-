import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/api/dashboardApi';
import { toast } from 'react-hot-toast';

export const useDashboard = (autoRefresh = true, refreshInterval = 30000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const [overview, realtime, trends] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getRealTimeMetrics(),
        dashboardApi.getUsageTrends()
      ]);

      setData({
        overview,
        realtime,
        trends
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const exportReport = useCallback(async (format, dateRange) => {
    try {
      await dashboardApi.exportReport(format, dateRange);
      toast.success('Report exported successfully');
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    exportReport,
    refetch: fetchData
  };
};
