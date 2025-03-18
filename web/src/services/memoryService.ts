import { apiCall } from '../utils/apiUtils';
import { Memory } from '../hooks/MemoryAPI';

export const MemoryService = {
  async fetchMemories(): Promise<Memory[]> {
    try {
      const response = await apiCall('GET', '/memory');
      return response;
    } catch (error) {
      throw error;
    }
  }
};
