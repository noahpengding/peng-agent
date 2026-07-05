import { apiCall } from '../utils/apiUtils';
import type { MemoryPageResponse } from '../hooks/MemoryAPI';

export const MemoryService = {
  async fetchMemories(username: string, page = 1, search = ''): Promise<MemoryPageResponse> {
    try {
      const response = await apiCall('POST', '/memory', {
        user_name: username,
        page,
        search,
      }) as MemoryPageResponse;
      return {
        ...response,
        memories: response.memories.map((memory) => ({
          ...memory,
          id: String(memory.id),
        })),
      };
    } catch (error) {
      throw error;
    }
  },
};
