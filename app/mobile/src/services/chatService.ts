import { apiCall } from '../utils/apiCall';
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
  };
}

type FeedbackValue = 'upvote' | 'downvote' | 'no_response';

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

const sendMessageWithXhr = (
  apiUrl: string,
  request: ChatRequest,
  token: string | null,
  processPayloadLine: (line: string) => boolean,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let buffer = '';
    let completed = false;

    const processDelta = () => {
      const currentText = xhr.responseText || '';
      const delta = currentText.slice(cursor);
      if (!delta) return;

      cursor = currentText.length;
      buffer += delta;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (completed) break;
        completed = processPayloadLine(line);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.LOADING) {
        processDelta();
        return;
      }

      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      processDelta();

      if (buffer.trim() && !completed) {
        completed = processPayloadLine(buffer);
        buffer = '';
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(`API error (${xhr.status}): ${xhr.responseText || 'Request failed'}`);
        onError(error);
        reject(error);
        return;
      }

      onComplete();
      resolve();
    };

    xhr.onerror = () => {
      const error = new Error('Network request failed');
      onError(error);
      reject(error);
    };

    xhr.open('POST', apiUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.send(JSON.stringify(request));
  });
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

      // React Native fetch buffers stream chunks until request completion.
      // We use XHR with LOADING events for incremental parsing and live rendering.
      await sendMessageWithXhr(apiUrl, request, token, processPayloadLine, onComplete, onError);
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
