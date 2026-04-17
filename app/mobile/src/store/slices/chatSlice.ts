import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Message, UploadedImage } from '@/types/ChatInterface.types';
import { ChatService } from '../../services/chatService';
import { fetchBaseModels } from './modelSlice';

interface SendMessageArgs {
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

interface SubmitFeedbackArgs {
  messageId: string;
  chatId: number;
  userName: string;
  feedback: FeedbackValue;
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
  knowledgeBase: string;
  selectedToolNames: string[];
  shortTermMemory: number[];
}

const initialState: ChatState = {
  messages: [],
  input: '',
  isLoading: false,
  error: null,
  isSidebarHidden: false,
  uploadedImages: [],

  baseModel: 'gpt-4',
  knowledgeBase: 'default',
  selectedToolNames: [],
  shortTermMemory: [],
};

const SUPPORTED_CHUNK_TYPES: Array<NonNullable<Message['type']>> = [
  'output_text',
  'reasoning_summary',
  'tool_calls',
  'tool_output',
];

const extractChatIdFromChunk = (chunk: string): number | null => {
  const trimmed = chunk.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/-?\d+/);
  if (!match) return null;
  const id = Number(match[0]);
  return Number.isInteger(id) ? id : null;
};

// Async thunk for sending message
export const sendMessage = createAsyncThunk('chat/sendMessage', async (args: SendMessageArgs, { dispatch, rejectWithValue }) => {
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
          dispatch(attachChatIdToMessage({ messageId, chatId: chatIdFromChunk }));
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
});

export const submitMessageFeedback = createAsyncThunk('chat/submitMessageFeedback', async (args: SubmitFeedbackArgs, { rejectWithValue }) => {
  try {
    await ChatService.updateFeedback(args.chatId, args.userName, args.feedback);
    return args;
  } catch (error) {
    return rejectWithValue((error as Error).message);
  }
});

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
    setKnowledgeBase: (state, action: PayloadAction<string>) => {
      state.knowledgeBase = action.payload;
    },
    setSelectedToolNames: (state, action: PayloadAction<string[]>) => {
      state.selectedToolNames = action.payload;
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
      const normalizedType = type?.trim() as Message['type'];

      if (done && !chunk) return;
      if (!normalizedType || !SUPPORTED_CHUNK_TYPES.includes(normalizedType)) return;

      if (normalizedType === 'output_text') {
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
      } else {
        const lastMessage = state.messages[state.messages.length - 1];
        const isContinuation = lastMessage && lastMessage.type === normalizedType && lastMessage.messageId === messageId;

        if (isContinuation) {
          lastMessage.content += chunk;
        } else {
          state.messages.push({
            role: 'assistant',
            content: chunk,
            type: normalizedType as Message['type'],
            folded: false,
            messageId,
          });
        }
      }
    },
    finishMessage: (state, action: PayloadAction<{ messageId: string }>) => {
      const { messageId } = action.payload;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i];
        if (m.messageId === messageId) {
          if (m.type && m.type !== 'output_text' && m.type !== 'assistant' && m.type !== 'user') {
            m.folded = true;
          } else if (m.type === 'output_text') {
            m.content = m.content.replace(/\n\n+/g, '\n');
          }
        }
      }
    },

    updateMemoryWithChatId: (state, action: PayloadAction<number>) => {
      state.shortTermMemory.push(action.payload);
    },
    attachChatIdToMessage: (state, action: PayloadAction<{ messageId: string; chatId: number }>) => {
      const { messageId, chatId } = action.payload;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const message = state.messages[i];
        if (message.messageId === messageId && message.type === 'output_text') {
          message.chatId = chatId;
          message.feedback = message.feedback || 'no_response';
          message.feedbackUpdating = false;
          break; // Usually only one output_text per messageId
        }
      }
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
        state.error = action.payload as string;
        state.messages.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error.',
          type: 'output_text',
        });
      })
      .addCase(submitMessageFeedback.pending, (state, action) => {
        const { messageId } = action.meta.arg;
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const message = state.messages[i];
          if (message.messageId === messageId && message.type === 'output_text') {
            message.feedbackUpdating = true;
            break;
          }
        }
      })
      .addCase(submitMessageFeedback.fulfilled, (state, action) => {
        const { messageId, feedback } = action.payload;
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const message = state.messages[i];
          if (message.messageId === messageId && message.type === 'output_text') {
            message.feedback = feedback;
            message.feedbackUpdating = false;
            break;
          }
        }
      })
      .addCase(submitMessageFeedback.rejected, (state, action) => {
        const { messageId } = action.meta.arg;
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const message = state.messages[i];
          if (message.messageId === messageId && message.type === 'output_text') {
            message.feedbackUpdating = false;
            break;
          }
        }
        state.error = action.payload as string;
      })
      .addCase(fetchBaseModels.fulfilled, (state, action) => {
        const { models, defaultBaseModel } = action.payload;
        if (defaultBaseModel) {
          state.baseModel = defaultBaseModel;
        } else if (models.length > 0) {
          state.baseModel = models[0].model_name || 'gpt-4';
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
  setKnowledgeBase,
  setSelectedToolNames,
  setShortTermMemory,
  setMessages,
  resetState,
  setError,
  handleChunk,
  finishMessage,
  updateMemoryWithChatId,
  attachChatIdToMessage,
} = chatSlice.actions;
export default chatSlice.reducer;
