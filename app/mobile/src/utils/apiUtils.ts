import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Android emulator localhost: 10.0.2.2
// iOS simulator localhost: 127.0.0.1
// Physical device: Your machine's IP
// Ideally this should be in an env file
export const BASE_URL = 'http://10.0.2.2:8000';

export const apiCall = async (method: string, endpoint: string, data?: Record<string, unknown>) => {
  const url = `${BASE_URL}${endpoint}`;
  const token = await SecureStore.getItemAsync('access_token');

  try {
    const response = await axios({
      method,
      url,
      data: method === 'POST' || method === 'PUT' || method === 'PATCH' ? data : undefined,
      params: method === 'GET' ? data : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (response.status === 204) {
      return null;
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
             await SecureStore.deleteItemAsync('access_token');
        }
        const errorMessage = error.response?.data?.message || `API error: ${error.response?.status}`;
        throw new Error(errorMessage);
    }
    throw error;
  }
};
