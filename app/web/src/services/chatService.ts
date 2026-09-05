import { apiCall } from '../utils/apiUtils';
import { storage } from '../utils/storage';
import { buildApiUrl } from '../utils/apiBase';

interface ChatRequest {
  user_name: string;
  message: string;
  knowledge_base: string;
  image?: string[];
  config: {
    operator: string;
    base_model: string;
    tools_name: string[];
    short_term_memory: number[];
    ip_address: string;
    temp_chat: boolean;
  };
}

type FeedbackValue = 'upvote' | 'downvote' | 'no_response';

const CHAT_RETRY_COUNT = 3;

const fetchChatResponse = async (apiUrl: string, options: RequestInit): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(apiUrl, options);
    } catch (error) {
      if (attempt === CHAT_RETRY_COUNT) throw error;
    }

    if (response) {
      if (response.ok) return response;

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === CHAT_RETRY_COUNT) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      await response.body?.cancel().catch(() => undefined);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
};

const createPayloadLineProcessor = (
  onChunk: (chunk: string, type: string, done: boolean) => void
) => {
  return (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const normalized = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    if (!normalized) return false;

    try {
      const data = JSON.parse(normalized);
      onChunk(data.chunk, data.type, data.done);
      return Boolean(data.done);
    } catch {
      // Ignore malformed or partial lines.
      return false;
    }
  };
};

const processBufferedLines = (payload: string, processPayloadLine: (line: string) => boolean): boolean => {
  const lines = payload.split('\n');
  let completed = false;

  for (const line of lines) {
    if (completed) break;
    completed = processPayloadLine(line);
  }

  return completed;
};

export const ChatService = {
  async sendMessage(
    request: ChatRequest,
    onChunk: (chunk: string, type: string, done: boolean) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const apiUrl = buildApiUrl('/chat');

      // Get auth token from storage
      const token = await storage.getItem('access_token');

      const processPayloadLine = createPayloadLineProcessor(onChunk);

      const response = await fetchChatResponse(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        credentials: 'include', // Include cookies
      });

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let isCompleted = false;

        while (true) {
          if (isCompleted) {
            onComplete();
            break;
          }

          const { done, value } = await reader.read();

          if (done) {
            // Flush any buffered final line before completing.
            if (buffer.trim()) {
              isCompleted = processBufferedLines(buffer, processPayloadLine);
              buffer = '';
            }
            if (!isCompleted) {
              isCompleted = true;
              onComplete();
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (isCompleted) break;
            isCompleted = processPayloadLine(line);
          }
        }
      } else {
        // React Native may not expose a readable stream body; parse the full text payload instead.
        const rawText = await response.text();
        processBufferedLines(rawText, processPayloadLine);
        // Let UI paint chunk updates before completion state cleanup/folding.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        onComplete();
      }
    } catch (error) {
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error(String(error)));
      }
    }
  },

  async updateFeedback(chatId: number, userName: string, feedback: FeedbackValue): Promise<void> {
    await apiCall('POST', '/chat_feedback', {
      chat_id: chatId,
      user_name: userName,
      feedback,
    });
  },
};
