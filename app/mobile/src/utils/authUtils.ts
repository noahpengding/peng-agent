import { apiCall } from './apiUtils';

// Login function that calls the backend API
export const login = async (username: string, password: string) => {
  const response = await apiCall('POST', '/login', { username, password });
  return response;
};
