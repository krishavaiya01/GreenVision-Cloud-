import apiClient from './apiClient';

export const assistantApi = {
  chat: (payload) => apiClient.post('/ai/assistant/chat', payload),
  context: () => apiClient.get('/ai/assistant/context'),
  email: () => apiClient.post('/ai/assistant/email'),
  reset: () => apiClient.post('/ai/assistant/reset'),
};

export default assistantApi;