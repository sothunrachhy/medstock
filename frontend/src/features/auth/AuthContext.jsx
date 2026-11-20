import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { csrfToken, tokenStore } from '@/lib/api';
import { auth, loadReference, roleAllows } from '@/lib/backend';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // A CSRF cookie means a refresh session may exist: try to restore it before showing the login page.
  const [loading, setLoading] = useState(() => !!csrfToken());

  const start = useCallback(async (u) => {
    await loadReference().catch(() => {});
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('medstock_token'); // token of the previous API, no longer used
    } catch {
      /* ignore */
    }
    if (!csrfToken()) return;
    auth
      .restore()
      .then(start)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [start]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (username, password) => start(await auth.login(username, password)), [start]);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      /* the session is gone either way */
    }
    setUser(null);
  }, []);

  const can = useCallback((module, action = 'read') => roleAllows(user?.role, module, action), [user]);

  const value = useMemo(() => ({ user, loading, login, logout, can, setUser }), [user, loading, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
