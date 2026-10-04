import axios from 'axios';

// Automatically detect API host based on environment and hostname (works seamlessly locally and after deployment)
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const isViteDev =
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port === '5173';
    if (isViteDev) {
      return 'http://localhost:5000/api';
    }
    return `${window.location.origin}/api`;
  }
  return '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

const getRoleFromPath = () => {
  const path = window.location.pathname || '';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/driver')) return 'driver';
  if (path.startsWith('/user')) return 'user';
  return null;
};

export const getActiveToken = () => {
  const pathRole = getRoleFromPath();
  if (pathRole) {
    const roleSessionToken = sessionStorage.getItem(`shuttle_token_${pathRole}`);
    if (roleSessionToken) return roleSessionToken;
    const roleLocalToken = localStorage.getItem(`shuttle_token_${pathRole}`);
    if (roleLocalToken) return roleLocalToken;
  }
  return (
    sessionStorage.getItem('shuttle_token') ||
    localStorage.getItem('shuttle_token') ||
    null
  );
};

// Request interceptor to attach JWT token isolated per portal role & tab
api.interceptors.request.use(
  (config) => {
    const token = getActiveToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 unauth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const path = window.location.pathname;
      const pathRole = getRoleFromPath();
      if (path.startsWith('/admin') || path.startsWith('/user') || path.startsWith('/driver')) {
        sessionStorage.removeItem('shuttle_token');
        sessionStorage.removeItem('shuttle_user');
        if (pathRole) {
          sessionStorage.removeItem(`shuttle_token_${pathRole}`);
          sessionStorage.removeItem(`shuttle_user_${pathRole}`);
          localStorage.removeItem(`shuttle_token_${pathRole}`);
          localStorage.removeItem(`shuttle_user_${pathRole}`);
        }
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
