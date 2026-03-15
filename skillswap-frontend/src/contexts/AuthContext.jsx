/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  authAPI,
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  registerAuthFailureHandler,
  setAuthTokens,
  subscribeAuthState,
  userAPI,
} from '../services/api.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAccessToken());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeAuthState(({ accessToken }) => {
      setToken(accessToken || '');
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unregister = registerAuthFailureHandler(() => {
      setUser(null);
      setToken('');
      setError('Session expired. Please sign in again.');
    });

    return unregister;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = getAccessToken();
      const storedRefreshToken = getRefreshToken();

      if (!storedToken && !storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        if (!storedToken && storedRefreshToken) {
          await authAPI.refreshToken(storedRefreshToken);
        }

        const profile = await userAPI.getProfile();
        setUser(profile);
        setError('');
      } catch (bootstrapError) {
        clearAuthSession();
        setUser(null);
        setToken('');
        setError(bootstrapError?.message || 'Unable to restore your session');
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = useCallback(async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authAPI.login(credentials);
      setUser(data.user);
      setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setError('');
      return data;
    } catch (loginError) {
      setError(loginError.message);
      throw loginError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setIsLoading(true);
    try {
      const data = await authAPI.register(payload);
      setUser(data.user);
      setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setError('');
      return data;
    } catch (registerError) {
      setError(registerError.message);
      throw registerError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authAPI.logout();
      setUser(null);
      clearAuthSession();
      setError('');
      toast.success('Signed out successfully');
    } catch (logoutError) {
      clearAuthSession();
      setUser(null);
      setError('');
      throw logoutError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    logout,
    register,
    setUser,
  }), [error, isLoading, login, logout, register, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
};
