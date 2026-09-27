import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only 401 Unauthorized indicates invalid/expired session
    if (error.response && error.response.status === 401) {
      const isLoginPage = window.location.hash.includes('/login') || window.location.pathname.includes('/login');
      if (!isLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.hash = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
