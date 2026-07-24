// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loginUser, registerUser, fetchCurrentUser } from '../api/auth';

const TOKEN_KEY = 'arl_token';
const USER_KEY = 'arl_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [checking, setChecking] = useState(!!localStorage.getItem(TOKEN_KEY));

  const persist = (nextToken, nextUser) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    setToken(nextToken);
    setUser(nextUser);
  };

  // Validate any stored token once on load (checking already starts false
  // when there's no token, so nothing to do in that case).
  useEffect(() => {
    if (!token) return;
    fetchCurrentUser()
      .then(({ user: freshUser }) => persist(token, freshUser))
      .catch(() => persist(null, null))
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const { token: newToken, user: newUser } = await loginUser({ email, password });
    persist(newToken, newUser);
    return newUser;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { token: newToken, user: newUser } = await registerUser({ name, email, password });
    persist(newToken, newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    persist(null, null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, checking, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
