import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub?: string;
  username?: string;
  exp?: number;
}

interface AuthState {
  token: string | null;
  user: string | null;
  isAuthenticated: boolean;
}

const getInitialState = (): AuthState => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return { token: null, user: null, isAuthenticated: false };
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const currentTime = Date.now() / 1000;
    // Require a valid numeric exp that is in the future
    if (typeof decoded.exp !== 'number' || decoded.exp < currentTime) {
      localStorage.removeItem('access_token');
      return { token: null, user: null, isAuthenticated: false };
    }
    const user = decoded.username || decoded.sub || token;
    return { token, user, isAuthenticated: true };
  } catch {
    localStorage.removeItem('access_token');
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
      localStorage.setItem('access_token', token);
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        const currentTime = Date.now() / 1000;
        // Require a valid numeric exp that is in the future
        if (typeof decoded.exp !== 'number' || decoded.exp < currentTime) {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          localStorage.removeItem('access_token');
          return;
        }
        state.user = decoded.username || decoded.sub || token;
        state.isAuthenticated = true;
      } catch {
        // If decoding fails, we consider the token invalid for safety
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        localStorage.removeItem('access_token');
      }
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('access_token');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
