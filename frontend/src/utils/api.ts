import axios, { AxiosInstance, InternalAxiosRequestConfig, CanceledError } from 'axios';
import { AuthSession, changeAuthSession, getAuthSession, isCurrentAuthSession } from './authSession';

declare module 'axios' {
  interface AxiosRequestConfig { authSession?: AuthSession }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SAFE_RETRY_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _safeRetryAttempted?: boolean;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
}) as AxiosInstance & {
  setToken: (token: string | null) => void;
};

api.interceptors.request.use(
  (config) => {
    config.authSession ??= getAuthSession();
    if (!isCurrentAuthSession(config.authSession)) throw new CanceledError('Session ended');
    const token = config.authSession.token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.config.authSession && !isCurrentAuthSession(response.config.authSession)
    ? Promise.reject(new CanceledError('Session ended')) : response,
  async (error) => {
    const requestConfig = error.config as RetryableRequestConfig | undefined;
    if (axios.isCancel(error) || (requestConfig?.authSession && !isCurrentAuthSession(requestConfig.authSession))) {
      return Promise.reject(new CanceledError('Session ended'));
    }
    const method = requestConfig?.method?.toLowerCase();
    const status = error.response?.status;
    const shouldRetry =
      requestConfig
      && method
      && SAFE_RETRY_METHODS.has(method)
      && !requestConfig._safeRetryAttempted
      && (!error.response || RETRYABLE_STATUS_CODES.has(status));

    // 参照系だけを1回再試行する。登録・更新・削除は二重実行を避けるため再試行しない。
    if (shouldRetry) {
      requestConfig._safeRetryAttempted = true;
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      return api(requestConfig);
    }

    if (error.response?.status === 401) {
      const requestAuthorization = error.config?.headers?.Authorization;
      const requestToken =
        typeof requestAuthorization === 'string'
          ? requestAuthorization.replace(/^Bearer\s+/i, '')
          : null;
      const currentToken = localStorage.getItem('token');

      // ログイン前の古い通信が、新しく発行されたトークンを消さないようにする。
      if (currentToken && (!requestToken || requestToken === currentToken)) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// setTokenメソッドを追加
api.setToken = changeAuthSession;
