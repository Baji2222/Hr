import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Central place to turn axios errors into readable messages for the UI.
export function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong';
}

export default api;
