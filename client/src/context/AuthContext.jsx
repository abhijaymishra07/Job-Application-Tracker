import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jobtrack_token');
    if (!token) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('jobtrack_token');
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('jobtrack_token', data.token);
        setUser(data.user);
      },
      async register(payload) {
        const { data } = await api.post('/auth/register', payload);
        localStorage.setItem('jobtrack_token', data.token);
        setUser(data.user);
      },
      logout() {
        localStorage.removeItem('jobtrack_token');
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
