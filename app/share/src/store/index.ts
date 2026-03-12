import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import modelReducer from './slices/modelSlice';
import toolReducer from './slices/toolSlice';
import chatReducer from './slices/chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    models: modelReducer,
    tools: toolReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
