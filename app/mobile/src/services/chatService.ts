import { ChatRequest } from '@shared/types';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../utils/apiUtils';
import 'fast-text-encoding';

export const ChatService = {
  async sendMessage(
    request: ChatRequest,
    onChunk: (chunk: string, type: string, done: boolean) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // The web app proxies /proxy/chat to backend/chat
      const finalUrl = `${BASE_URL}/chat`;

      const token = await SecureStore.getItemAsync('access_token');

      const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // @ts-ignore
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
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              onChunk(data.chunk, data.type, data.done);
              if (data.done) {
                isCompleted = true;
              }
            } catch (e) {
              // ignore
            }
          }
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
};
