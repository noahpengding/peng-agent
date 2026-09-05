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
    ip_address: string;
    temp_chat: boolean;
  };
}

type FeedbackValue = 'upvote' | 'downvote' | 'no_response';

interface StreamPayload {
  chunk: string;
  type: string;
  done: boolean;
}

const STREAM_BATCH_WINDOW_MS = 100;
const CHAT_RETRY_COUNT = 3;

class ChatRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

const parsePayloadLine = (line: string): StreamPayload | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!normalized) return null;

  try {
    const data = JSON.parse(normalized) as Partial<StreamPayload>;
    return {
      chunk: typeof data.chunk === 'string' ? data.chunk : String(data.chunk ?? ''),
      type: typeof data.type === 'string' ? data.type : '',
      done: Boolean(data.done),
    };
  } catch {
    // Ignore malformed or partial lines.
    return null;
  }
};

const sendMessageWithXhr = (
  apiUrl: string,
  request: ChatRequest,
  token: string | null,
  onChunk: (chunk: string, type: string, done: boolean) => void,
  onComplete: () => void
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let buffer = '';
    let completed = false;
    let settled = false;
    let responseStarted = false;
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    let queuedPayloads: StreamPayload[] = [];

    const clearBatchTimer = () => {
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
    };

    const flushQueuedPayloads = () => {
      clearBatchTimer();
      if (queuedPayloads.length === 0) {
        return;
      }

      const pendingPayloads = queuedPayloads;
      queuedPayloads = [];

      for (const payload of pendingPayloads) {
        onChunk(payload.chunk, payload.type, payload.done);
      }
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      flushQueuedPayloads();
      const retryable = !responseStarted && (
        xhr.status === 0 || xhr.status === 408 || xhr.status === 429 || xhr.status >= 500
      );
      reject(new ChatRequestError(message, retryable));
    };

    const scheduleBatchFlush = () => {
      if (batchTimer !== null) {
        return;
      }

      batchTimer = setTimeout(() => {
        batchTimer = null;
        flushQueuedPayloads();
      }, STREAM_BATCH_WINDOW_MS);
    };

    const queuePayload = (payload: StreamPayload): boolean => {
      if (payload.done) {
        flushQueuedPayloads();
        onChunk(payload.chunk, payload.type, true);
        completed = true;
        return true;
      }

      const lastQueuedPayload = queuedPayloads[queuedPayloads.length - 1];
      if (lastQueuedPayload && lastQueuedPayload.type === payload.type) {
        lastQueuedPayload.chunk += payload.chunk;
      } else {
        if (lastQueuedPayload && lastQueuedPayload.type !== payload.type) {
          flushQueuedPayloads();
        }

        queuedPayloads.push({ ...payload });
      }

      scheduleBatchFlush();
      return false;
    };

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
        const payload = parsePayloadLine(line);
        if (!payload) continue;
        completed = queuePayload(payload);
      }
    };

    xhr.onreadystatechange = () => {
      if (settled) return;
      if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED && xhr.status >= 200 && xhr.status < 300) {
        responseStarted = true;
      }

      if (xhr.readyState === XMLHttpRequest.LOADING) {
        if (xhr.status >= 200 && xhr.status < 300) processDelta();
        return;
      }

      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        fail(`API error (${xhr.status}): ${xhr.responseText || 'Request failed'}`);
        return;
      }

      processDelta();

      if (buffer.trim() && !completed) {
        const payload = parsePayloadLine(buffer);
        if (payload) {
          completed = queuePayload(payload);
        }
        buffer = '';
      }

      flushQueuedPayloads();

      clearBatchTimer();
      settled = true;
      onComplete();
      resolve();
    };

    xhr.onerror = () => {
      fail('Network request failed');
    };
    xhr.ontimeout = () => fail('Request timed out');

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

      // React Native fetch buffers stream chunks until request completion.
      // We use XHR with LOADING events for incremental parsing and live rendering.
      for (let attempt = 0; ; attempt++) {
        try {
          await sendMessageWithXhr(apiUrl, request, token, onChunk, onComplete);
          return;
        } catch (error) {
          if (!(error instanceof ChatRequestError) || !error.retryable || attempt === CHAT_RETRY_COUNT) {
            throw error;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        }
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
