import { apiCall } from '../utils/apiUtils';
import { Memory } from '../hooks/MemoryAPI';

export const MemoryService = {
  async fetchMemories(username: string): Promise<Memory[]> {
    try {
      const response = await apiCall('POST', '/memory', { user_name: username });
      return response;
    } catch (error) {
      throw error;
    }
  },
};
