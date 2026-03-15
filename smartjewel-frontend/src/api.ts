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

// ---- Auth refresh (debug-instrumented) -------------------------------------

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'src/api.ts:refreshAccessToken',message:'Attempting token refresh',data:{hasRefreshToken:true},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const originalAuth = api.defaults.headers.common['Authorization'];
  try {
    // For refresh, set refresh token temporarily as Authorization
    api.defaults.headers.common['Authorization'] = `Bearer ${refreshToken}`;
    const res = await api.post<{ access_token: string }>('/auth/refresh');
    const newAccess = res.data?.access_token;
    if (newAccess) {
      localStorage.setItem('access_token', newAccess);
      setAuthToken(newAccess);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'src/api.ts:refreshAccessToken',message:'Token refresh success',data:{accessTokenLength:newAccess.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      return newAccess;
    }
    return null;
  } catch (e: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'src/api.ts:refreshAccessToken',message:'Token refresh failed',data:{status:e?.response?.status ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  } finally {
    // Restore original auth header (if any); setAuthToken already updated defaults for new access token
    if (originalAuth) api.defaults.headers.common['Authorization'] = originalAuth;
    else delete api.defaults.headers.common['Authorization'];
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
      authHeaderStart: authHeader ? String(authHeader).substring(0, 30) : 'NONE'
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
  async (error) => {
    console.error('[API Response Error]', {
      status: error.response?.status,
      url: error.response?.config?.url,
      data: error.response?.data
    });

    const status = error.response?.status;
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean });

    // H1: Access token expired -> refresh using refresh_token and retry once
    if (status === 401 && originalRequest && !originalRequest._retry) {
      const url = String(originalRequest.url || '');
      if (!url.includes('/auth/refresh')) {
        originalRequest._retry = true;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'src/api.ts:responseInterceptor',message:'401 received; will try refresh+retry',data:{url,hadAuthHeader:!!api.defaults.headers.common['Authorization']},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        try {
          if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshAccessToken().finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
          }

          const newAccess = await refreshPromise;
          if (newAccess) {
            // ensure this request uses latest token
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
            return api.request(originalRequest);
          }
        } catch {
          // fallthrough to reject
        }
      }
    }
    return Promise.reject(error);
  }
);

// Export normalized API base for asset URL composition
export const API_BASE_URL = API_BASE;