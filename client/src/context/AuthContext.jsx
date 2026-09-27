import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

const getPathRole = () => {
  const path = window.location.pathname || '';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/driver')) return 'driver';
  if (path.startsWith('/user')) return 'user';
  return null;
};

const toStorageSafeUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  const copy = { ...u };
  if (typeof copy.avatar_url === 'string' && copy.avatar_url.length > 10000) {
    delete copy.avatar_url;
  }
  if (typeof copy.id_card_url === 'string' && copy.id_card_url.length > 10000) {
    delete copy.id_card_url;
  }
  if (typeof copy.license_photo_url === 'string' && copy.license_photo_url.length > 10000) {
    delete copy.license_photo_url;
  }
  return copy;
};

const safeSetItem = (storage, key, val) => {
  try {
    storage.setItem(key, val);
  } catch (_) {
    try {
      ['shuttle_user', 'shuttle_user_admin', 'shuttle_user_user', 'shuttle_user_driver'].forEach((k) => {
        if (k !== key) storage.removeItem(k);
      });
      storage.setItem(key, val);
    } catch (__) {}
  }
};

const cleanupOversizedStorage = () => {
  const keys = ['shuttle_user', 'shuttle_user_admin', 'shuttle_user_user', 'shuttle_user_driver'];
  [sessionStorage, localStorage].forEach((storage) => {
    keys.forEach((k) => {
      try {
        const raw = storage.getItem(k);
        if (raw && raw.length > 20000) {
          const parsed = JSON.parse(raw);
          storage.setItem(k, JSON.stringify(toStorageSafeUser(parsed)));
        }
      } catch (_) {
        try {
          storage.removeItem(k);
        } catch (__) {}
      }
    });
  });
};

cleanupOversizedStorage();

const readInitialUser = () => {
  try {
    const pathRole = getPathRole();
    if (pathRole) {
      const roleSession = sessionStorage.getItem(`shuttle_user_${pathRole}`);
      if (roleSession) return JSON.parse(roleSession);
      const roleLocal = localStorage.getItem(`shuttle_user_${pathRole}`);
      if (roleLocal) return JSON.parse(roleLocal);
    }
    const tabUser = sessionStorage.getItem('shuttle_user');
    if (tabUser) return JSON.parse(tabUser);
    const savedUser = localStorage.getItem('shuttle_user');
    return savedUser ? JSON.parse(savedUser) : null;
  } catch (_) {
    return null;
  }
};

const readInitialToken = () => {
  const pathRole = getPathRole();
  if (pathRole) {
    const roleSession = sessionStorage.getItem(`shuttle_token_${pathRole}`);
    if (roleSession) return roleSession;
    const roleLocal = localStorage.getItem(`shuttle_token_${pathRole}`);
    if (roleLocal) return roleLocal;
  }
  return (
    sessionStorage.getItem('shuttle_token') ||
    localStorage.getItem('shuttle_token') ||
    null
  );
};

const persistSessionAndRole = (receivedToken, receivedUser) => {
  if (!receivedToken || !receivedUser) return;
  const roleKey = receivedUser.role || 'user';
  const userStr = JSON.stringify(toStorageSafeUser(receivedUser));

  safeSetItem(sessionStorage, 'shuttle_token', receivedToken);
  safeSetItem(sessionStorage, `shuttle_token_${roleKey}`, receivedToken);
  safeSetItem(localStorage, 'shuttle_token', receivedToken);
  safeSetItem(localStorage, `shuttle_token_${roleKey}`, receivedToken);

  safeSetItem(sessionStorage, 'shuttle_user', userStr);
  safeSetItem(sessionStorage, `shuttle_user_${roleKey}`, userStr);
  safeSetItem(localStorage, 'shuttle_user', userStr);
  safeSetItem(localStorage, `shuttle_user_${roleKey}`, userStr);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readInitialUser);
  const [token, setToken] = useState(readInitialToken);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const activeTok = token || readInitialToken();
      if (activeTok) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
            setToken(activeTok);
            persistSessionAndRole(activeTok, res.data.user);
          }
        } catch (err) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            console.warn('Session verification failed, logging out');
            logout();
          }
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, [token]);

  const login = async (email, password, expectedRole, organization_name) => {
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        expectedRole,
        organization_name
      });
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data;
        persistSessionAndRole(receivedToken, receivedUser);
        setToken(receivedToken);
        setUser(receivedUser);
        return { success: true, user: receivedUser };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (error) {
      const msg = error.response?.data?.message || 'Login request failed. Please check credentials.';
      return { success: false, message: msg };
    }
  };

  const register = async (userData) => {
    try {
      const res = await api.post('/auth/register', userData);
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data;
        persistSessionAndRole(receivedToken, receivedUser);
        setToken(receivedToken);
        setUser(receivedUser);
        return { success: true, user: receivedUser };
      }
      return { success: false, message: res.data.message || 'Registration failed' };
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    const roleKey = user?.role || getPathRole();
    sessionStorage.removeItem('shuttle_token');
    sessionStorage.removeItem('shuttle_user');
    if (roleKey) {
      sessionStorage.removeItem(`shuttle_token_${roleKey}`);
      sessionStorage.removeItem(`shuttle_user_${roleKey}`);
      localStorage.removeItem(`shuttle_token_${roleKey}`);
      localStorage.removeItem(`shuttle_user_${roleKey}`);
    }
    localStorage.removeItem('shuttle_token');
    localStorage.removeItem('shuttle_user');
    setToken(null);
    setUser(null);
  };

  const getDashboardPath = (userRole) => {
    const r = userRole || user?.role;
    switch (r) {
      case 'admin':
        return '/admin/dashboard';
      case 'driver':
        return '/driver/dashboard';
      case 'user':
      default:
        return '/user/dashboard';
    }
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      const roleKey = next.role || getPathRole() || 'user';
      const nextStr = JSON.stringify(toStorageSafeUser(next));
      safeSetItem(sessionStorage, 'shuttle_user', nextStr);
      safeSetItem(sessionStorage, `shuttle_user_${roleKey}`, nextStr);
      safeSetItem(localStorage, 'shuttle_user', nextStr);
      safeSetItem(localStorage, `shuttle_user_${roleKey}`, nextStr);
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
        updateUser,
        getDashboardPath
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
