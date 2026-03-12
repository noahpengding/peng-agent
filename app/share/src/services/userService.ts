import { apiCall } from '../utils/apiUtils';
import { UserProfile, UpdateUserProfilePayload } from '../hooks/UserAPI';

export const UserService = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiCall('GET', '/user/profile');
    return response;
  },

  async updateProfile(payload: UpdateUserProfilePayload): Promise<void> {
    const payloadToSend = {
      email: payload.email,
      default_base_model: payload.default_base_model,
      default_output_model: payload.default_output_model,
      default_embedding_model: payload.default_embedding_model,
      s3_access_key: payload.s3_access_key,
      s3_secret_key: payload.s3_secret_key,
      system_prompt: payload.system_prompt,
      long_term_memory: payload.long_term_memory,
      password: payload.password,
    };
    await apiCall('PUT', '/user/profile', payloadToSend);
  },

  async regenerateToken(): Promise<{ api_token: string }> {
    const response = await apiCall('POST', '/user/regenerate_token');
    return response;
  },
};
