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
  };
}

type FeedbackValue = 'upvote' | 'downvote' | 'no_response';

interface StreamPayload {
  chunk: string;
  type: string;
  done: boolean;
}

const STREAM_BATCH_WINDOW_MS = 100;

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
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let buffer = '';
    let completed = false;
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
      if (xhr.readyState === XMLHttpRequest.LOADING) {
        processDelta();
        return;
      }

      if (xhr.readyState !== XMLHttpRequest.DONE) {
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

      if (xhr.status < 200 || xhr.status >= 300) {
        clearBatchTimer();
        queuedPayloads = [];
        const error = new Error(`API error (${xhr.status}): ${xhr.responseText || 'Request failed'}`);
        onError(error);
        reject(error);
        return;
      }

      clearBatchTimer();
      onComplete();
      resolve();
    };

    xhr.onerror = () => {
      clearBatchTimer();
      queuedPayloads = [];
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

      // React Native fetch buffers stream chunks until request completion.
      // We use XHR with LOADING events for incremental parsing and live rendering.
      await sendMessageWithXhr(apiUrl, request, token, onChunk, onComplete, onError);
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
