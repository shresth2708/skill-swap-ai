export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  matches: '/matches',
  swaps: '/swaps',
  swapDetail: (swapId = ':swapId') => `/swaps/${swapId}`,
  profile: '/profile',
  publicProfile: (userId = ':userId') => `/users/${userId}`,
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
};
