import axios from 'axios';

// Get API_BASE with safe fallback
let API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

// Normalize API_BASE (strip spaces)
API_BASE = (API_BASE || '').toString().split(',')[0].trim();

// Validate and fix API_BASE if needed
if (!API_BASE) {
  console.warn('VITE_API_BASE is empty or undefined. Using default: http://127.0.0.1:5000');
  API_BASE = 'http://127.0.0.1:5000';
} else {
  try {
    new URL(API_BASE);
  } catch (error) {
    console.warn('Invalid VITE_API_BASE URL:', API_BASE, 'Using default: http://127.0.0.1:5000');
    API_BASE = 'http://127.0.0.1:5000';
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15s timeout to avoid infinite loading
});

export interface AuthTokens { access_token: string; refresh_token: string; }

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('[setAuthToken] Authorization header set', { tokenLength: token.length, tokenStart: token.substring(0, 20) });
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('[setAuthToken] Authorization header cleared');
  }
}

// Add request interceptor to log Authorization header
api.interceptors.request.use(
  (config) => {
    const authHeader = config.headers['Authorization'];
    console.log('[API Request]', {
      method: config.method,
      url: config.url,
      hasAuthHeader: !!authHeader,
      authHeaderStart: authHeader ? authHeader.substring(0, 30) : 'NONE'
    });
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to log status and errors
api.interceptors.response.use(
  (response) => {
    console.log('[API Response]', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    console.error('[API Response Error]', {
      status: error.response?.status,
      url: error.response?.config?.url,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Removed get_db function as it referenced Flask backend code

// Export normalized API base for asset URL composition
export const API_BASE_URL = API_BASE;
