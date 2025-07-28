import { useState } from 'react';
import { ToolService } from '../services/toolService';

// Export the Model interface from the hook file for component use
export interface Tool {
  id: string;
  name: string;
  type: string;
  url: string;
}

export const useToolApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllTools = async (): Promise<Tool[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await ToolService.getAllTools();
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTools = async (): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const message = await ToolService.updateTools();
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getAllTools,
    updateTools,
    isLoading,
    error,
  };
};
