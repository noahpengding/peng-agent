export interface ChatRequest {
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

export interface Message {
  role: string;
  content: string;
  images?: string[];
  type?: 'tool_calls' | 'tool_output' | 'reasoning_summary' | 'output_text' | 'user' | 'assistant';
  folded?: boolean;
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
  preview: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: string | null;
  isLoading?: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export interface JwtPayload {
  sub?: string;
  username?: string;
  exp: number;
}
