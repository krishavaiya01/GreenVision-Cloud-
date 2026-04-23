import apiClient from '../../utils/apiClient';

// Fetch AWS issue logs (error/warn) with optional filters
// params: { level, sinceMinutes, limit, logGroup }
export const cloudLogsApi = {
  async getAwsIssueLogs(params = {}) {
    const qs = new URLSearchParams();
    if (params.level) qs.set('level', params.level);
    if (params.sinceMinutes) qs.set('sinceMinutes', String(params.sinceMinutes));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.logGroup) qs.set('logGroup', params.logGroup);
    const url = `cloud/aws/logs/issues${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await apiClient.get(url);
    return res.data?.data || [];
  },
  async getIssueLogs(params = {}) {
    const qs = new URLSearchParams();
    if (params.provider) qs.set('provider', params.provider);
    if (params.level) qs.set('level', params.level);
    if (params.sinceMinutes) qs.set('sinceMinutes', String(params.sinceMinutes));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.logGroup) qs.set('logGroup', params.logGroup);
    const url = `cloud/logs/issues${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await apiClient.get(url);
    return res.data?.data || [];
  }
};

export default cloudLogsApi;
