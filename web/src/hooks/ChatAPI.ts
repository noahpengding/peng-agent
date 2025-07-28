import { useState } from 'react';
import { ChatService } from '../services/chatService';

interface ChatRequest {
  user_name: string;
  message: string;
  image?: string;
  config: {
    operator: string;
    base_model: string;
    tools_name: string[];
    short_term_memory: string[];
    long_term_memory: string[];
  };
}

export const useChatApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (
    request: ChatRequest,
    onChunk: (chunk: string, type: string) => void,
    onComplete?: () => void
  ): Promise<void> => {
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    
    try {
      await ChatService.sendMessage(
        request,
        // On each chunk with type
        (chunk: string, type: string) => {
          onChunk(chunk, type);
        },
        // On complete
        () => {
          setIsLoading(false);
          setIsStreaming(false);
          onComplete?.();
        },
        // On error
        (err: Error) => {
          setError(err.message);
          setIsLoading(false);
          setIsStreaming(false);
          throw err;
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
      setIsStreaming(false);
      throw err;
    }
  };

  return {
    sendMessage,
    isLoading,
    isStreaming,
    error,
  };
};
