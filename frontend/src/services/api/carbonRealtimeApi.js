// src/services/api/carbonRealtimeApi.js
import apiClient from './apiClient';

export const carbonRealtimeApi = {
  async getRealtime(params = {}) {
    const qs = new URLSearchParams();
    if (params.sinceMinutes) qs.set('sinceMinutes', String(params.sinceMinutes));
    const url = `/cloud/carbon/realtime${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await apiClient.get(url);
    return res.data?.data || null;
  }
};

export default carbonRealtimeApi;
