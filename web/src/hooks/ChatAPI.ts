// src/hooks/useChatApi.ts
import { useState } from 'react';
import { API_BASE_URL } from "../config/config";

interface ModelConfig {
  operator: string;
  base_model: string;
  embedding_model: string;
  collection_name: string;
  web_search: boolean;
  short_term_memory: number[];
  long_term_memory: number[];
}

interface ChatRequest {
  user_name: string;
  message: string;
  image?: string;
  config: ModelConfig;
}

interface ChatResponse {
  user_name: string;
  message: string;
  image?: string;
}

export const useChatApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (
    request: ChatRequest
  ): Promise<ChatResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        user_name: request.user_name,
        message: request.message,
        config: request.config,
      };
      
      console.log('Sending payload:', payload); // For debugging
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Remove credentials if not needed for your API
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {user_name: data.user_name, message: data.message, image: data.image};
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendMessage,
    isLoading,
    error,
  };
};
