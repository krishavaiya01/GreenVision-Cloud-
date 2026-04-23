import apiClient from './apiClient';

export const k8sApi = {
  listClusters: () => apiClient.get('/k8s/clusters').then(r=>r.data),
  getInventory: (provider) => apiClient.get(`/k8s/${provider}/inventory`).then(r=>r.data),
  getPods: (provider) => apiClient.get(`/k8s/${provider}/pods`).then(r=>r.data)
};
