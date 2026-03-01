import { apiCall } from '../utils/apiUtils';
import { UserProfile, UpdateUserProfilePayload } from '../hooks/UserAPI';

export const UserService = {
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await apiCall('GET', '/user/profile');
      return response;
    } catch (error) {
      throw error;
    }
  },

  async updateProfile(payload: UpdateUserProfilePayload): Promise<void> {
    try {
      await apiCall('PUT', '/user/profile', payload);
    } catch (error) {
      throw error;
    }
  },

  async regenerateToken(): Promise<{ api_token: string }> {
    try {
      const response = await apiCall('POST', '/user/regenerate_token');
      return response;
    } catch (error) {
      throw error;
    }
  },
};