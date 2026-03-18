export const test = 'test';

// Use runtime config if available, fall back to build-time env var
export const API_BASE_URL =
  window.RUNTIME_CONFIG?.API_BASE_URL !== 'RUNTIME_API_BASE_URL_PLACEHOLDER' && window.RUNTIME_CONFIG?.API_BASE_URL
    ? window.RUNTIME_CONFIG.API_BASE_URL
    : import.meta.env.VITE_BACKEND_URL;

export const API_PREFIX = '/api';
