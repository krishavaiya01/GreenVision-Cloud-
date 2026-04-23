import apiClient from './apiClient';

export const authApi = {
  signup: async (data) => apiClient.post('/auth/signup', data).then(res => res.data),
  login: async (data) => apiClient.post('/auth/login', data).then(res => res.data),
  refreshToken: async (token) => apiClient.post('/auth/refresh-token', { token }).then(res => res.data),
  getMe: async () => apiClient.get('/auth/me').then(res => res.data),
  getUsers: async () => apiClient.get('/auth/getusers').then(res => res.data),
  updateSettings: async (updates) => apiClient.put('/auth/settings', updates).then(res => res.data),
  deleteAccount: async () => apiClient.delete('/auth/delete').then(res => res.data),
  updatePassword: async (currentPassword, newPassword) =>
    apiClient.patch('/auth/password', { currentPassword, newPassword }).then(res => res.data)
};
