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
      const payloadToSend = {
        email: payload.email,
        default_base_model: payload.default_base_model,
        default_output_model: payload.default_output_model,
        default_embedding_model: payload.default_embedding_model,
        system_prompt: payload.system_prompt,
        long_term_memory: payload.long_term_memory,
        password: payload.password,
      };
      await apiCall('PUT', '/user/profile', payloadToSend);
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
