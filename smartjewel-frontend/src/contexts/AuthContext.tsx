import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setAuthToken } from '../api';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { firebaseAuthService } from '../services/firebaseAuth';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: {
    _id: string;
    role_name: string;
  };
  // Optional profile fields
  phone_number?: string;
  address?: string;
  // New claims shape from backend
  roles?: string[];
  perms?: string[];
  // Backward compatibility (optional)
  permissions?: string[];
  // Firebase specific fields
  photoURL?: string;
  displayName?: string;
  isFirebaseUser?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (tokens: { access_token: string; refresh_token: string }, userData: User) => void;
  loginWithFirebase: (firebaseUser: FirebaseUser) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (patch: Partial<User>) => void;
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
        const isFirebase = localStorage.getItem('firebase_user') === 'true';
        const firebaseToken = localStorage.getItem('firebase_token');

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

        // If Firebase session exists but no backend JWTs, attempt exchange silently
        if (!accessToken && isFirebase && firebaseToken) {
          try {
            const exchange = await api.post('/auth/firebase-login', { id_token: firebaseToken });
            const newAccess = exchange.data.access_token;
            const newRefresh = exchange.data.refresh_token;
            const newUser = exchange.data.user;
            localStorage.setItem('access_token', newAccess);
            localStorage.setItem('refresh_token', newRefresh);
            localStorage.setItem('user_data', JSON.stringify(newUser));
            setAuthToken(newAccess);
            setUser(newUser);
          } catch (e) {
            // Ignore; will retry on next login action
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

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !user) {
        // Firebase user signed in but no local user data
        // This handles cases where Firebase auth persists but local storage was cleared
        try {
          await loginWithFirebase(firebaseUser);
        } catch (error) {
          console.error('Failed to sync Firebase user:', error);
        }
      } else if (!firebaseUser && user?.isFirebaseUser) {
        // Firebase user signed out
        logout();
      }
    });

    return () => unsubscribe();
  }, [user]);

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

  const loginWithFirebase = async (firebaseUser: FirebaseUser) => {
    try {
      // Exchange Firebase ID token for backend JWTs mapped by email
      const idToken = await firebaseUser.getIdToken();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const exchange = await api.post('/auth/firebase-login', { id_token: idToken }, { signal: controller.signal });
        clearTimeout(timeoutId);

        const tokens = { access_token: exchange.data.access_token, refresh_token: exchange.data.refresh_token };
        const userData = { ...(exchange.data.user as User), isFirebaseUser: true };

        // Persist tokens and user data
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('user_data', JSON.stringify(userData));
        localStorage.setItem('firebase_user', 'true');
        localStorage.setItem('firebase_token', idToken);

        // Set axios auth header and update state
        setAuthToken(tokens.access_token);
        setUser(userData);
      } catch (exchangeError) {
        // Do not complete login without a backend session; surface error to UI
        // Persist Firebase token so a later retry can work silently
        localStorage.setItem('firebase_user', 'true');
        localStorage.setItem('firebase_token', idToken);
        throw exchangeError;
      }
    } catch (error) {
      console.error('Error in loginWithFirebase:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // If it's a Firebase user, sign out from Firebase
      if (user?.isFirebaseUser) {
        await firebaseAuthService.signOut();
      }
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
    }

    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('firebase_user');
    localStorage.removeItem('firebase_token');

    // Clear axios headers
    setAuthToken(undefined);

    // Clear state
    setUser(null);
  };

  const isAuthenticated = !!user;

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...patch } as User : (patch as User);
      try { localStorage.setItem('user_data', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    loginWithFirebase,
    logout,
    isAuthenticated,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};