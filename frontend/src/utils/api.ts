import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
}) as AxiosInstance & {
  setToken: (token: string | null) => void;
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestAuthorization = error.config?.headers?.Authorization;
      const requestToken =
        typeof requestAuthorization === 'string'
          ? requestAuthorization.replace(/^Bearer\s+/i, '')
          : null;
      const currentToken = localStorage.getItem('token');

      // ログイン前の古い通信が、新しく発行されたトークンを消さないようにする。
      if (currentToken && (!requestToken || requestToken === currentToken)) {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// setTokenメソッドを追加
api.setToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};
