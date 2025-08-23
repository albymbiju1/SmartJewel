import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setAuthToken } from '../api';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: {
    _id: string;
    role_name: string;
  };
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (tokens: { access_token: string; refresh_token: string }, userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        const userData = localStorage.getItem('user_data');

        if (accessToken && userData) {
          // Set the token in axios headers
          setAuthToken(accessToken);
          
          // Parse and set user data
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);

          // Verify token is still valid by making a test request
          try {
            await api.get('/auth/me');
          } catch (error: any) {
            // Token might be expired, try to refresh
            if (refreshToken && error.response?.status === 401) {
              try {
                // For refresh, we need to set the refresh token as the auth header temporarily
                const originalAuth = api.defaults.headers.common['Authorization'];
                api.defaults.headers.common['Authorization'] = `Bearer ${refreshToken}`;
                
                const response = await api.post('/auth/refresh');
                
                // Restore original auth header
                if (originalAuth) {
                  api.defaults.headers.common['Authorization'] = originalAuth;
                }
                
                const newAccessToken = response.data.access_token;
                localStorage.setItem('access_token', newAccessToken);
                setAuthToken(newAccessToken);
              } catch (refreshError) {
                // Refresh failed, clear auth data
                logout();
              }
            } else {
              // Other error, clear auth data
              logout();
            }
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (tokens: { access_token: string; refresh_token: string }, userData: User) => {
    // Store tokens and user data in localStorage
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    
    // Set token in axios headers
    setAuthToken(tokens.access_token);
    
    // Update state
    setUser(userData);
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');

    // Clear axios headers
    setAuthToken(undefined);

    // Clear state
    setUser(null);
  };

  const isAuthenticated = !!user;

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};