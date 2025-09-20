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
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}

// Removed get_db function as it referenced Flask backend code

// Export normalized API base for asset URL composition
export const API_BASE_URL = API_BASE;
