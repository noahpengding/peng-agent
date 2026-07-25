import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Message, UploadedImage } from '@/types/ChatInterface.types';
import { ChatService } from '../../services/chatService';
import { fetchBaseModels } from './modelSlice';
import { parsePythonBytes, binaryToDataUrl } from '../../utils/imageUtils';
import { extractGeneratedImageUrl, isImageGenerationToolCall } from '@/utils/generatedImageUtils';
import { getCurrentIpAddress } from '@/utils/ipAddress';

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
    ip_address?: string;
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
  lastRequest: SendMessageArgs | null;
  retryMessageId: string | null;

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
  lastRequest: null,
  retryMessageId: null,

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

const buildStreamMessageKey = (
  messageId: string,
  type: Message['type'],
  ordinal: number
): string => `${messageId}:${type ?? 'assistant'}:${ordinal}`;

const hasImageGenerationToolCall = (messages: Message[], messageId: string): boolean => {
  return messages.some((message) => {
    return message.messageId === messageId && message.type === 'tool_calls' && isImageGenerationToolCall(message.content);
  });
};

const cloneSendMessageArgs = (args: SendMessageArgs): SendMessageArgs => ({
  ...args,
  image: args.image ? [...args.image] : undefined,
  config: {
    ...args.config,
    tools_name: [...args.config.tools_name],
    short_term_memory: [...args.config.short_term_memory],
  },
});

// Async thunk for sending message
export const sendMessage = createAsyncThunk('chat/sendMessage', async (args: SendMessageArgs, { dispatch, rejectWithValue }) => {
  // Generate a messageId for this turn
  const messageId = Math.random().toString(36).substring(2) + Date.now().toString(36);

  try {
    let chatIdFromChunk: number | null = null;
    const request = {
      ...args,
      image: args.image ? [...args.image] : undefined,
      config: {
        ...args.config,
        tools_name: [...args.config.tools_name],
        short_term_memory: [...args.config.short_term_memory],
        ip_address: args.config.ip_address ?? await getCurrentIpAddress(),
      },
    };

    await ChatService.sendMessage(
      request,
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
    return request;
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
      state.lastRequest = null;
      state.retryMessageId = null;
    },
    resetState: (state) => {
      state.messages = [];
      state.input = '';
      state.isLoading = false;
      state.error = null;
      state.lastRequest = null;
      state.retryMessageId = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    prepareLastTurnRetry: (state) => {
      if (!state.lastRequest || state.isLoading) {
        return;
      }

      let lastUserMessageIndex = -1;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === 'user' || state.messages[i].role === 'human') {
          lastUserMessageIndex = i;
          break;
        }
      }

      if (lastUserMessageIndex < 0) {
        return;
      }

      const lastUserMessage = state.messages[lastUserMessageIndex];
      const retryUserMessage: Message = {
        ...lastUserMessage,
        images: lastUserMessage.images ? [...lastUserMessage.images] : undefined,
      };

      state.messages.splice(lastUserMessageIndex);
      state.messages.push(retryUserMessage);
      state.shortTermMemory = [...state.lastRequest.config.short_term_memory];
      state.error = null;
      state.retryMessageId = null;
    },

    // Actions for streaming
    handleChunk: (state, action: PayloadAction<{ chunk: string; type: string; done: boolean; messageId: string }>) => {
      const { chunk, type, done, messageId } = action.payload;
      let normalizedType = type?.trim() as Message['type'];

      if (done && !chunk) return;
      if (!normalizedType || !SUPPORTED_CHUNK_TYPES.includes(normalizedType)) return;

      const lastMessage = state.messages[state.messages.length - 1];
      const isGeneratedImageToolOutput = normalizedType === 'tool_output' && hasImageGenerationToolCall(state.messages, messageId);
      const generatedImageUrl = isGeneratedImageToolOutput ? extractGeneratedImageUrl(chunk) : null;

      // Detect binary image in tool_output or continuation of a binary output reclassified as output_text
      if (normalizedType === 'tool_output' && chunk.trim().startsWith("b'")) {
        normalizedType = 'output_text';
      } else if (isGeneratedImageToolOutput) {
        normalizedType = 'output_text';
      } else if (lastMessage && lastMessage.type === 'output_text' && lastMessage.messageId === messageId && lastMessage.content.startsWith("b'")) {
        normalizedType = 'output_text';
      }

      if (normalizedType === 'output_text') {
        const isOutputContinuation = lastMessage && lastMessage.type === 'output_text' && lastMessage.messageId === messageId;

        if (isOutputContinuation) {
          if (generatedImageUrl) {
            lastMessage.images = lastMessage.images || [];
            lastMessage.images.push(generatedImageUrl);
          } else {
            lastMessage.content += chunk;
          }
        } else {
          // Collapse only the trailing chunk block for this streamed turn.
          if (lastMessage?.messageId === messageId) {
            for (let i = state.messages.length - 1; i >= 0; i--) {
              const message = state.messages[i];
              if (message.messageId !== messageId) {
                break;
              }
              if (message.type === 'reasoning_summary' || message.type === 'tool_calls' || message.type === 'tool_output') {
                message.folded = true;
              }
            }
          }

          state.messages.push({
            role: 'assistant',
            content: generatedImageUrl ? '' : chunk,
            images: generatedImageUrl ? [generatedImageUrl] : undefined,
            type: 'output_text',
            messageId,
            clientKey: buildStreamMessageKey(messageId, 'output_text', state.messages.length),
          });
        }
      } else {
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
            clientKey: buildStreamMessageKey(messageId, normalizedType as Message['type'], state.messages.length),
          });
        }
      }
    },
    finishMessage: (state, action: PayloadAction<{ messageId: string }>) => {
      const { messageId } = action.payload;
      let hasSeenTargetMessage = false;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i];
        if (m.messageId === messageId) {
          hasSeenTargetMessage = true;
          // Process binary tool output that was reclassified as output_text
          if (m.type === 'output_text' && m.content.trim().startsWith("b'")) {
            const bytes = parsePythonBytes(m.content);
            if (bytes) {
              const dataUrl = binaryToDataUrl(bytes);
              m.images = m.images || [];
              m.images.push(dataUrl);
              m.content = ''; // Clear the raw binary string
            }
          }

          if (m.type && m.type !== 'output_text' && m.type !== 'assistant' && m.type !== 'user') {
            m.folded = true;
          } else if (m.type === 'output_text') {
            m.content = m.content.replace(/\n\n+/g, '\n');
          }
        } else if (hasSeenTargetMessage) {
          break;
        }
      }
    },

    updateMemoryWithChatId: (state, action: PayloadAction<number>) => {
      state.shortTermMemory.push(action.payload);
    },
    attachChatIdToMessage: (state, action: PayloadAction<{ messageId: string; chatId: number }>) => {
      const { messageId, chatId } = action.payload;
      let hasSeenTargetMessage = false;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const message = state.messages[i];
        if (message.messageId === messageId) {
          hasSeenTargetMessage = true;
          if (message.type === 'output_text') {
            message.chatId = chatId;
            message.feedback = message.feedback || 'no_response';
            message.feedbackUpdating = false;
            state.retryMessageId = messageId;
            break; // Usually only one output_text per messageId
          }
        } else if (hasSeenTargetMessage) {
          break;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.retryMessageId = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.input = '';
        state.uploadedImages = [];
        state.lastRequest = cloneSendMessageArgs(action.payload);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.lastRequest = null;
        state.messages.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error.',
          type: 'output_text',
          clientKey: `error:${state.messages.length}`,
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
  prepareLastTurnRetry,
  handleChunk,
  finishMessage,
  updateMemoryWithChatId,
  attachChatIdToMessage,
} = chatSlice.actions;
export default chatSlice.reducer;
