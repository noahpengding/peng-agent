import { useState } from 'react';
import { ModelService } from '../services/modelService';

// Export the Model interface from the hook file for component use
export interface Model {
  id: string;
  operator: string;
  type: string;
  model_name: string;
  isAvailable: boolean;
  input_text: boolean;
  output_text: boolean;
  input_image: boolean;
  output_image: boolean;
  input_audio: boolean;
  output_audio: boolean;
  input_video: boolean;
  output_video: boolean;
  reasoning_effect: string;
}

export const useModelApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllModels = async (): Promise<Model[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await ModelService.getAllModels();
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModelAvailability = async (modelName: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message = await ModelService.toggleModelAvailability(modelName);
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModelMultimodal = async (modelName: string, column: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message = await ModelService.toggleModelMultimodal(modelName, column);
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModelReasoningEffect = async (modelName: string, reasoning_effect: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message = await ModelService.toggleModelReasoningEffect(modelName, reasoning_effect);
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshModels = async (): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message = await ModelService.refreshModels();
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
    getAllModels,
    toggleModelAvailability,
    toggleModelMultimodal,
    toggleModelReasoningEffect,
    refreshModels,
    isLoading,
    error,
  };
};
