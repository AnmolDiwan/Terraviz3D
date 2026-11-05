import { useState, useEffect } from 'react';
import { authService } from '../services/auth.service.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await authService.getMe();
        setUser(data.user || (data.userId ? data : null));
      } catch (err) {
        if (typeof window !== 'undefined') localStorage.removeItem('tv3d_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const handleAuthExpired = () => {
      if (typeof window !== 'undefined') localStorage.removeItem('tv3d_token');
      setUser(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.login(username, password);
      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem('tv3d_token', data.token);
      }
      setUser(data.session?.user || data.user || null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.register(username, email, password);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (sessionId) => {
    try {
      await authService.logout(sessionId);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (typeof window !== 'undefined') localStorage.removeItem('tv3d_token');
      setUser(null);
    }
  };

  return { user, loading, error, login, logout, register };
}
