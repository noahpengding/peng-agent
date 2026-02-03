interface ChatRequest {
  user_name: string;
  message: string;
  image?: string[];
  config: {
    operator: string;
    base_model: string;
    tools_name: string[];
    short_term_memory: number[];
    long_term_memory: string[];
  };
}

export const ChatService = {
  async sendMessage(
    request: ChatRequest,
    onChunk: (chunk: string, type: string, done: boolean) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const apiUrl = `/proxy/chat`;

      // Get auth token from localStorage
      const token = localStorage.getItem('access_token');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let isCompleted = false; // Flag to prevent duplicate completion calls

      while (true) {

        const { done, value } = await reader.read();

        if (done) {
          if (!isCompleted) {
            isCompleted = true;
            onComplete();
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process any complete JSON lines in the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (isCompleted) {
            break;
          }
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              onChunk(data.chunk, data.type, data.done);
              if (data.done) {
                isCompleted = true;
              }
            } catch {
              // Silently handle JSON parsing errors to avoid console warnings
              // This can happen with incomplete streaming data
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
