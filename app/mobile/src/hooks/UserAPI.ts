import { useState, useCallback } from 'react';
import { UserService } from '../services/userService';

export interface UserProfile {
  username: string;
  email: string;
  api_token: string;
  default_base_model: string;
  default_output_model: string;
  default_embedding_model: string;
  s3_access_key: string;
  s3_secret_key: string;
  system_prompt: string | null;
  long_term_memory: string[];
}

export interface UpdateUserProfilePayload {
  email: string;
  default_base_model: string;
  default_output_model: string;
  default_embedding_model: string;
  s3_access_key: string;
  s3_secret_key: string;
  system_prompt: string | null;
  long_term_memory: string[];
  password?: string;
}

export const useUserApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProfile = useCallback(async (): Promise<UserProfile> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await UserService.getProfile();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (payload: UpdateUserProfilePayload): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await UserService.updateProfile(payload);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const regenerateToken = useCallback(async (): Promise<{ api_token: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await UserService.regenerateToken();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getProfile,
    updateProfile,
    regenerateToken,
    isLoading,
    error,
  };
};
