import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Message, UploadedImage } from '../../components/ChatInterface.types';
import { ChatService } from '../../services/chatService';
import { fetchBaseModels } from './modelSlice';

interface SendMessageArgs {
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

interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  error: string | null;
  isSidebarHidden: boolean;
  uploadedImages: UploadedImage[];

  // Selection state
  baseModel: string;
  selectedToolNames: string[];
  shortTermMemory: number[];
  longTermMemory: string[];
}

const initialState: ChatState = {
  messages: [],
  input: '',
  isLoading: false,
  error: null,
  isSidebarHidden: false,
  uploadedImages: [],

  baseModel: 'gpt-4',
  selectedToolNames: [],
  shortTermMemory: [],
  longTermMemory: [],
};

const extractChatIdFromChunk = (chunk: string): number | null => {
  const trimmed = chunk.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/-?\d+/);
  if (!match) return null;
  const id = Number(match[0]);
  return Number.isInteger(id) ? id : null;
};

// Async thunk for sending message
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (args: SendMessageArgs, { dispatch, rejectWithValue }) => {
    // Generate a messageId for this turn
    const messageId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      let chatIdFromChunk: number | null = null;

      await ChatService.sendMessage(
        args,
        (chunk: string, type: string, done: boolean) => {
          if (done) {
            const chatId = extractChatIdFromChunk(chunk);
            if (chatId !== null) {
              chatIdFromChunk = chatId;
              return;
            }
          }
          dispatch(handleChunk({ chunk, type, done, messageId }));
        },
        () => {
          dispatch(finishMessage({ messageId }));
          if (chatIdFromChunk !== null) {
            dispatch(updateMemoryWithChatId(chatIdFromChunk));
          }
        },
        (error: Error) => {
          throw error;
        }
      );
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setInput: (state, action: PayloadAction<string>) => {
      state.input = action.payload;
    },
    setSidebarHidden: (state, action: PayloadAction<boolean>) => {
      state.isSidebarHidden = action.payload;
    },
    setUploadedImages: (state, action: PayloadAction<UploadedImage[]>) => {
      state.uploadedImages = action.payload;
    },
    addUserMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    setBaseModel: (state, action: PayloadAction<string>) => {
      state.baseModel = action.payload;
    },
    setSelectedToolNames: (state, action: PayloadAction<string[]>) => {
      state.selectedToolNames = action.payload;
    },
    toggleToolName: (state, action: PayloadAction<{ toolName: string; isSelected: boolean }>) => {
      const { toolName, isSelected } = action.payload;
      if (isSelected) {
        if (!state.selectedToolNames.includes(toolName)) {
          state.selectedToolNames.push(toolName);
        }
      } else {
        state.selectedToolNames = state.selectedToolNames.filter((name) => name !== toolName);
      }
    },
    setShortTermMemory: (state, action: PayloadAction<number[]>) => {
      state.shortTermMemory = action.payload;
    },
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    resetState: (state) => {
       state.messages = [];
       state.input = '';
       state.isLoading = false;
       state.error = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Actions for streaming
    handleChunk: (state, action: PayloadAction<{ chunk: string; type: string; done: boolean; messageId: string }>) => {
      const { chunk, type, done, messageId } = action.payload;

      if (done && !chunk) return;

      if (type === 'tool_calls' || type === 'tool_output') {
        state.messages.push({
          role: 'assistant',
          content: chunk,
          type: type as Message['type'],
          folded: false,
          messageId,
        });
      } else if (type === 'reasoning_summary') {
        const lastMessage = state.messages[state.messages.length - 1];
        const isContinuation = lastMessage && lastMessage.type === 'reasoning_summary' && lastMessage.messageId === messageId;

        if (isContinuation) {
          lastMessage.content += chunk;
        } else {
          state.messages.push({
            role: 'assistant',
            content: chunk,
            type: 'reasoning_summary',
            folded: false,
            messageId,
          });
        }
      } else if (type === 'output_text') {
        const lastMessage = state.messages[state.messages.length - 1];
        const isOutputContinuation = lastMessage && lastMessage.type === 'output_text' && lastMessage.messageId === messageId;

        if (isOutputContinuation) {
          lastMessage.content += chunk;
        } else {
          state.messages.push({
            role: 'assistant',
            content: chunk,
            type: 'output_text',
            messageId,
          });
        }
      }
    },
    finishMessage: (state, action: PayloadAction<{ messageId: string }>) => {
      const { messageId } = action.payload;
      state.messages = state.messages.map((m) => {
        if (m.messageId === messageId) {
          if (m.type === 'tool_calls' || m.type === 'tool_output' || m.type === 'reasoning_summary') {
            return { ...m, folded: true };
          } else if (m.type === 'output_text') {
            return { ...m, content: m.content.replace(/\n\n+/g, '\n') };
          }
        }
        return m;
      });
    },

    updateMemoryWithChatId: (state, action: PayloadAction<number>) => {
      state.shortTermMemory.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.isLoading = false;
        state.input = '';
        state.uploadedImages = [];
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? action.error?.message ?? 'Unknown error';
        state.messages.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error.',
          type: 'output_text',
        });
      })
      .addCase(fetchBaseModels.fulfilled, (state, action) => {
        if (action.payload && action.payload.length > 0) {
           state.baseModel = action.payload[0].model_name || 'gpt-4';
        }
      });
  },
});

export const {
  setInput,
  setSidebarHidden,
  setUploadedImages,
  addUserMessage,
  setBaseModel,
  setSelectedToolNames,
  toggleToolName,
  setShortTermMemory,
  setMessages,
  resetState,
  setError,
  handleChunk,
  finishMessage,
  updateMemoryWithChatId,
} = chatSlice.actions;
export default chatSlice.reducer;
