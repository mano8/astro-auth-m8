import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { configureAuth, type AuthRuntimeConfig } from "../config.js";
import { login as apiLogin, logout as apiLogout, refreshToken } from "../api/auth.js";
import { getProfile } from "../api/profile.js";
import type { UserPublic } from "../schemas.js";

export type AuthContextValue = {
  user: UserPublic | null;
  loading: boolean;
  error: unknown;
  login: (username: string, password: string) => Promise<UserPublic>;
  logout: () => Promise<void>;
  reload: () => Promise<UserPublic | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, config, bootstrap = true }: { children: ReactNode; config?: Partial<AuthRuntimeConfig>; bootstrap?: boolean }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(bootstrap);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (config) configureAuth(config);
  }, [config]);

  const reload = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
      setError(null);
      return profile;
    } catch (err) {
      setUser(null);
      setError(err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    setLoading(true);
    refreshToken()
      .then(() => reload())
      .catch((err) => {
        if (!cancelled) {
          setUser(null);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrap, reload]);

  const login = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    const profile = await getProfile();
    setUser(profile);
    setError(null);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, login, logout, reload }), [user, loading, error, login, logout, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
