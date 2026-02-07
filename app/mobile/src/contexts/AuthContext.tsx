import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import * as SecureStore from 'expo-secure-store';
import { AuthContextType, JwtPayload } from '@shared/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<string | null>(null);
  // We can expose isLoading if needed for Splash Screen
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('access_token');
      if (storedToken) {
        checkToken(storedToken);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('Failed to load token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const checkToken = (t: string) => {
      try {
        const decodedToken: JwtPayload = jwtDecode(t);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          logout();
        } else {
          setToken(t);
          setIsAuthenticated(true);
          const username = decodedToken.username || decodedToken.sub || t;
          setUser(username);
        }
      } catch {
        logout();
      }
  }

  const login = async (newToken: string) => {
    await SecureStore.setItemAsync('access_token', newToken);
    checkToken(newToken);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('access_token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
