import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: string | null;
  login: (token: string) => void;
  logout: () => void;
}

// Define JWT payload interface
interface JwtPayload {
  sub?: string;
  username?: string;
  exp: number;
  // Add other JWT fields as needed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
  const [user, setUser] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check token validity on mount and after any token changes
    if (token) {
      try {
        const decodedToken: JwtPayload = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          // Token has expired
          logout();
        } else {
          setIsAuthenticated(true);

          // Extract username from token
          // Try to get username from standard fields, fallback to using the token itself
          const username = decodedToken.username || decodedToken.sub || token;
          setUser(username);
        }
      } catch (error) {
        // Invalid token
        logout();
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);

    // User and authentication state will be updated by the useEffect
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
  };

  return <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
