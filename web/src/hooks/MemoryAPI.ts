import { useState } from 'react';
import { MemoryService } from '../services/memoryService';

// Export the Memory interface from the hook file
export interface Memory {
  id: string;
  user_name: string;
  type: string;
  base_model: string;
  human_input: string;
  ai_response: string;
  timestamp?: string;
}

export const useMemoryApi = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetchMemories = async (username: string): Promise<Memory[]> => {
        setIsLoading(true);
        setError(null);
        
        try {
            const data = await MemoryService.fetchMemories(username);
            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { fetchMemories, isLoading, error };
}