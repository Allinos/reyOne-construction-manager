import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '../lib/api';
import { getAccessToken, setTokens, clearTokens } from '../lib/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrap, setBootstrap] = useState(null); // { company, modules, settings }
  const [loading, setLoading] = useState(true);

  // Loads the full bootstrap payload (branding + enabled modules + config + me).
  const loadBootstrap = useCallback(async () => {
    const data = await unwrap(api.get('/bootstrap'));
    setUser(data.user);
    setBootstrap({ company: data.company, modules: data.modules, settings: data.settings });
    return data;
  }, []);

  // On first load, restore the session if a token is present.
  useEffect(() => {
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        await loadBootstrap();
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadBootstrap]);

  const login = useCallback(
    async (email, password) => {
      const data = await unwrap(api.post('/auth/login', { email, password }));
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      await loadBootstrap();
    },
    [loadBootstrap],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('reyone_refresh');
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    setBootstrap(null);
  }, []);

  // Permission check honoring the Owner wildcard.
  const can = useCallback(
    (permission) => {
      const perms = user?.permissions || [];
      return perms.includes('*') || perms.includes(permission);
    },
    [user],
  );

  const value = { user, bootstrap, loading, login, logout, can, reloadBootstrap: loadBootstrap };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
