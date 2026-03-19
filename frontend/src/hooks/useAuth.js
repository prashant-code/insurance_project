import { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data } = await apiClient.get('/auth/me');
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      await apiClient.post('/auth/login', { email, password });
      await checkUser();
      return true;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login strictly failed');
    }
  };

  const register = async (userData) => {
    try {
      await apiClient.post('/auth/register', userData);
      await login(userData.email, userData.password); // Auto-login after verification
      return true;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return { user, login, register, logout, loading };
};
