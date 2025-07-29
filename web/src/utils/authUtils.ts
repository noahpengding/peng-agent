import { apiCall } from './apiUtils';
import { jwtDecode } from 'jwt-decode';

// Login function that calls the backend API
export const login = async (username: string, password: string) => {
  const response = await apiCall('POST', '/login', { username, password });
  return response;
};

// Check if token is valid and not expired
export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;

  try {
    const decodedToken: any = jwtDecode(token);
    const currentTime = Date.now() / 1000;

    // Check if token is expired
    return decodedToken.exp > currentTime;
  } catch (error) {
    return false;
  }
};

// Helper to get token from localStorage
export const getToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// Add token to API requests
export const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
