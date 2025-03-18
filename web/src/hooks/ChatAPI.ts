import { useState } from 'react';
import { ChatService } from '../services/chatService';
import { Memory } from './MemoryAPI';

interface ChatResponse {
  message: string;
  image?: string;
}

interface ChatRequest {
  user_name: string;
  message: string;
  image?: string;
  config: {
    operator: string;
    base_model: string;
    embedding_model: string;
    collection_name: string;
    web_search: boolean;
    short_term_memory: any[];
    long_term_memory: any[];
    selected_memories: Memory[];
  };
}

export const useChatApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (request: ChatRequest): Promise<ChatResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await ChatService.sendMessage(request);
      return response;
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
