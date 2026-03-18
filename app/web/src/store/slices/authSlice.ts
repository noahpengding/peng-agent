import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';
import { storage } from '../../utils/storage';

interface JwtPayload {
  sub?: string;
  username?: string;
  exp: number;
}

interface AuthState {
  token: string | null;
  user: string | null;
  isAuthenticated: boolean;
}

const getInitialState = (): AuthState => {
  // Synchronously get item; if the adapter is asynchronous, this might return a promise and fail to parse,
  // but it's safe for initial start with MemoryStorage or localStorage.
  const token = storage.getItem('access_token');
  
  if (!token || typeof token !== 'string') {
    return { token: null, user: null, isAuthenticated: false };
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const currentTime = Date.now() / 1000;
    if (decoded.exp < currentTime) {
      storage.removeItem('access_token');
      return { token: null, user: null, isAuthenticated: false };
    }
    const user = decoded.username || decoded.sub || token;
    return { token, user, isAuthenticated: true };
  } catch {
    storage.removeItem('access_token');
    return { token: null, user: null, isAuthenticated: false };
  }
};

const initialState: AuthState = getInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<string>) => {
      const token = action.payload;
      state.token = token;
      storage.setItem('access_token', token);
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        state.user = decoded.username || decoded.sub || token;
        state.isAuthenticated = true;
      } catch {
        // If decoding fails, we consider the token invalid for safety
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        storage.removeItem('access_token');
      }
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      storage.removeItem('access_token');
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      // Used by mobile apps to asynchronously hydrate the store after mounting
      const token = action.payload;
      if (!token) {
        state.token = null;
        state.user = null;
        state.isAuthenticated = false;
        return;
      }
      
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          state.token = null;
          state.user = null;
          state.isAuthenticated = false;
          return;
        }
        state.token = token;
        state.user = decoded.username || decoded.sub || token;
        state.isAuthenticated = true;
      } catch {
        state.token = null;
        state.user = null;
        state.isAuthenticated = false;
      }
    }
  },
});

export const { login, logout, setToken } = authSlice.actions;
export default authSlice.reducer;
