export interface Message {
  role: string;
  content: string;
  images?: string[]; // Changed from image to images array for multiple image support
  // type distinguishes different message types: tool_calls, reasoning_summary, output_text
  type?: 'tool_calls' | 'tool_output' | 'reasoning_summary' | 'output_text' | 'user' | 'assistant';
  // folded indicates messages should be initially collapsed
  folded?: boolean;
  // messageId to track related messages
  messageId?: string;
}

export interface ModelInfo {
  id: string;
  operator: string;
  type: string;
  model_name: string;
  isAvailable: boolean;
}

export interface UploadedImage {
  path: string;
  preview: string; // Base64 for UI preview
}

export interface Tool {
  id: string;
  name: string;
  type: string;
  url: string;
}
