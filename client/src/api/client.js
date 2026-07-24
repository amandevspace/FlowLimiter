// client/src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});
// Attach the dashboard auth token, if present, to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('arl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const listKeys = () => api.get('/admin/keys').then((r) => r.data);

export const createKey = (payload) =>
  api.post('/admin/keys', payload).then((r) => r.data);

export const updateKey = (id, payload) =>
  api.patch(`/admin/keys/${id}`, payload).then((r) => r.data);

export const deactivateKey = (id) =>
  api.delete(`/admin/keys/${id}`).then((r) => r.data);

export const getTraffic = (apiKey, minutes = 15) =>
  api.get(`/stats/traffic/${apiKey}`, { params: { minutes } }).then((r) => r.data);

export const runCompare = (payload) =>
  api.post('/simulate/compare', payload).then((r) => r.data);

export default api;
