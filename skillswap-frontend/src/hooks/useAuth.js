import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';

export const useAuth = () => {
  const navigate = useNavigate();
  const auth = useAuthContext();

  const login = async (credentials) => {
    const data = await auth.login(credentials);
    navigate(ROUTES.dashboard, { replace: true });
    return data;
  };

  const register = async (payload, navigateAfter = true) => {
    const data = await auth.register(payload);
    if (navigateAfter) {
      navigate(ROUTES.dashboard, { replace: true });
    }
    return data;
  };

  const logout = async () => {
    await auth.logout();
    navigate(ROUTES.login, { replace: true });
  };

  return {
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    login,
    logout,
    register,
  };
};
