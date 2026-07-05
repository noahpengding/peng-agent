import { useState, useCallback } from 'react';
import { MemoryService } from '../services/memoryService';

// Export the Memory interface from the hook file
export interface Memory {
  id: string;
  user_name: string;
  type: string;
  base_model: string;
  human_input: string;
  other_input: string;
  ai_response: string;
  created_at?: string;
  timestamp?: string;
}

export interface MemoryPageResponse {
  memories: Memory[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  search: string;
}

export const useMemoryApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async (username: string, page = 1, search = ''): Promise<MemoryPageResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await MemoryService.fetchMemories(username, page, search);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  return { fetchMemories, isLoading, error };
};
