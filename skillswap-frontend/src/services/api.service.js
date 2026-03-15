import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const ACCESS_TOKEN_KEY = 'skillswap.accessToken';
const REFRESH_TOKEN_KEY = 'skillswap.refreshToken';

const authState = {
  accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || '',
};

const authStateListeners = new Set();
const authFailureListeners = new Set();

const notifyAuthState = () => {
  authStateListeners.forEach((listener) => listener({ ...authState }));
};

const persistAuthState = () => {
  if (authState.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, authState.accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (authState.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, authState.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const subscribeAuthState = (listener) => {
  authStateListeners.add(listener);
  listener({ ...authState });

  return () => {
    authStateListeners.delete(listener);
  };
};

export const registerAuthFailureHandler = (handler) => {
  authFailureListeners.add(handler);

  return () => {
    authFailureListeners.delete(handler);
  };
};

export const getAccessToken = () => authState.accessToken;
export const getRefreshToken = () => authState.refreshToken;

export const setAuthTokens = ({ accessToken, refreshToken } = {}) => {
  if (typeof accessToken !== 'undefined') {
    authState.accessToken = accessToken || '';
  }

  if (typeof refreshToken !== 'undefined') {
    authState.refreshToken = refreshToken || '';
  }

  persistAuthState();
  notifyAuthState();
};

export const clearAuthSession = () => {
  authState.accessToken = '';
  authState.refreshToken = '';
  persistAuthState();
  notifyAuthState();
};

const normalizeError = (error) => {
  const responseError = error?.response?.data?.error;

  if (responseError) {
    return {
      code: responseError.code || 'REQUEST_ERROR',
      message: responseError.message || 'Request failed',
    };
  }

  if (error?.code === 'ECONNABORTED') {
    return {
      code: 'TIMEOUT',
      message: 'Request timed out. Please try again.',
    };
  }

  return {
    code: error?.code || 'NETWORK_ERROR',
    message: error?.message || 'Something went wrong',
  };
};

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  // We use Bearer tokens (not cookies), so credentials are unnecessary and can
  // trigger CORS issues in local development.
  withCredentials: false,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = authState.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh');

    if (
      status === 401
      && originalRequest
      && !originalRequest._retry
      && !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearAuthSession();
        authFailureListeners.forEach((listener) => listener());
        window.location.assign('/login');
        return Promise.reject(normalizeError(error));
      }

      try {
        const refreshResponse = await refreshClient.post('/auth/refresh', { refreshToken });
        const newAccessToken = unwrap(refreshResponse)?.accessToken;

        if (!newAccessToken) {
          throw new Error('Refresh response did not include a new access token');
        }

        setAuthTokens({ accessToken: newAccessToken });
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        clearAuthSession();
        authFailureListeners.forEach((listener) => listener());
        window.location.assign('/login');
        return Promise.reject(normalizeError(refreshError));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

const request = async (config) => {
  const response = await api.request(config);
  return unwrap(response);
};

export const authAPI = {
  register: async (payload) => {
    const data = await request({ method: 'post', url: '/auth/register', data: payload });
    if (data?.accessToken) {
      setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    }
    return data;
  },
  login: async (payload) => {
    const data = await request({ method: 'post', url: '/auth/login', data: payload });
    if (data?.accessToken) {
      setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    }
    return data;
  },
  logout: async () => {
    try {
      const data = await request({ method: 'post', url: '/auth/logout' });
      return data;
    } finally {
      clearAuthSession();
    }
  },
  refreshToken: async (refreshToken = getRefreshToken()) => {
    const data = await request({
      method: 'post',
      url: '/auth/refresh',
      data: { refreshToken },
      headers: { Authorization: undefined },
      _skipAuthRetry: true,
    });

    if (data?.accessToken) {
      setAuthTokens({ accessToken: data.accessToken });
    }

    return data;
  },
  forgotPassword: async (payload) => request({ method: 'post', url: '/auth/forgot-password', data: payload }),
  resetPassword: async (payload) => request({ method: 'post', url: '/auth/reset-password', data: payload }),
};

export const userAPI = {
  getProfile: async () => request({ method: 'get', url: '/users/me' }),
  updateProfile: async (payload) => request({ method: 'put', url: '/users/me', data: payload }),
  addSkill: async (payload) => request({ method: 'post', url: '/users/me/skills', data: payload }),
  updateSkill: async (skillId, payload) => request({ method: 'put', url: `/users/me/skills/${skillId}`, data: payload }),
  removeSkill: async (skillId) => request({ method: 'delete', url: `/users/me/skills/${skillId}` }),
  addAvailability: async (payload) => request({ method: 'post', url: '/users/me/availability', data: payload }),
  updateAvailability: async (payload) => request({ method: 'put', url: '/users/me/availability', data: payload }),
  removeAvailability: async (slotId) => request({ method: 'delete', url: `/users/me/availability/${slotId}` }),
  searchUsers: async (params = {}) => request({ method: 'get', url: '/users/search', params }),
  getPublicProfile: async (userId) => request({ method: 'get', url: `/users/${userId}` }),
  getOnlineStatus: async (userId) => request({ method: 'get', url: `/users/${userId}/online` }),
  updateNotificationPreferences: async (payload) => request({ method: 'put', url: '/users/me/notification-preferences', data: payload }),
};

export const matchAPI = {
  getMatches: async (params = {}) => request({ method: 'get', url: '/matches', params }),
  getMatchById: async (matchId) => request({ method: 'get', url: `/matches/${matchId}` }),
  acceptMatch: async (matchId) => request({ method: 'post', url: `/matches/${matchId}/accept` }),
  declineMatch: async (matchId) => request({ method: 'post', url: `/matches/${matchId}/decline` }),
  explainMatch: async (matchId, params = {}) =>
    request({ method: 'get', url: `/matches/${matchId}/explain`, params }),
  getStats: async () => request({ method: 'get', url: '/matches/stats' }),
};

export const swapAPI = {
  createSwap: async (payload) => request({ method: 'post', url: '/swaps', data: payload }),
  getSwaps: async (params = {}) => request({ method: 'get', url: '/swaps', params }),
  getSwapById: async (swapId) => request({ method: 'get', url: `/swaps/${swapId}` }),
  acceptSwap: async (swapId) => request({ method: 'post', url: `/swaps/${swapId}/accept` }),
  declineSwap: async (swapId, payload = {}) => request({ method: 'post', url: `/swaps/${swapId}/decline`, data: payload }),
  cancelSwap: async (swapId, payload = {}) => request({ method: 'post', url: `/swaps/${swapId}/cancel`, data: payload }),
  startSwap: async (swapId) => request({ method: 'post', url: `/swaps/${swapId}/start` }),
  markComplete: async (swapId) => request({ method: 'post', url: `/swaps/${swapId}/complete` }),
  confirmComplete: async (swapId) => request({ method: 'post', url: `/swaps/${swapId}/complete-confirm` }),
  scheduleSession: async (swapId, payload) => request({ method: 'post', url: `/swaps/${swapId}/sessions`, data: payload }),
  rescheduleSession: async (swapId, sessionId, payload) => request({ method: 'put', url: `/swaps/${swapId}/sessions/${sessionId}/reschedule`, data: payload }),
  getActiveSwaps: async () => request({ method: 'get', url: '/swaps/active' }),
  getSwapStats: async () => request({ method: 'get', url: '/swaps/stats' }),
  getUpcomingSessions: async () => request({ method: 'get', url: '/swaps/sessions/upcoming' }),
};

export const chatAPI = {
  getMessages: async (swapId, params = {}) => request({ method: 'get', url: `/chats/${swapId}/messages`, params }),
  getUnreadCount: async () => request({ method: 'get', url: '/chats/unread-count' }),
  deleteMessage: async (swapId, messageId) => request({ method: 'delete', url: `/chats/${swapId}/messages/${messageId}` }),
};

export const reviewAPI = {
  submitReview: async (swapId, payload) => request({ method: 'post', url: `/swaps/${swapId}/reviews`, data: payload }),
  getReviewsForUser: async (userId, params = {}) => request({ method: 'get', url: `/users/${userId}/reviews`, params }),
  getReviewsForSwap: async (swapId) => request({ method: 'get', url: `/swaps/${swapId}/reviews` }),
};

export const notifAPI = {
  getNotifications: async (params = {}) => request({ method: 'get', url: '/notifications', params }),
  markRead: async (notificationId) => request({ method: 'put', url: `/notifications/${notificationId}/read` }),
  markAllRead: async () => request({ method: 'put', url: '/notifications/read-all' }),
  getUnreadCount: async () => request({ method: 'get', url: '/notifications/unread-count' }),
};

export const normalizeApiError = normalizeError;
export { api as apiClient };
