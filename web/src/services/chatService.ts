import { apiCall } from '../utils/apiUtils';

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
    short_term_memory: string[];
    long_term_memory: string[];
  };
}

export const ChatService = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await apiCall('POST', '/chat', request);
      return response;
    } catch (error) {
      throw error;
    }
  }
};
