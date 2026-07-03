import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { configureAuth, type AuthRuntimeConfig } from "../config.js";
import { login as apiLogin, logout as apiLogout, refreshToken } from "../api/auth.js";
import { getProfile } from "../api/profile.js";
import type { UserPublic } from "../schemas.js";
import { AuthQueryProvider } from "./AuthQueryProvider.js";

export type AuthContextValue = {
  user: UserPublic | null;
  loading: boolean;
  error: unknown;
  login: (username: string, password: string) => Promise<UserPublic>;
  logout: () => Promise<void>;
  reload: () => Promise<UserPublic | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_SESSION_EVENT = "fa-auth-m8:session";
const BOOTSTRAP_FAILURE_COOLDOWN_MS = 30_000;

type AuthSessionEvent = CustomEvent<{ user: UserPublic | null }>;

let bootstrapSessionPromise: Promise<UserPublic | null> | null = null;
let bootstrapFailureUntil = 0;

function emitAuthSession(user: UserPublic | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT, { detail: { user } }));
}

function bootstrapSession(): Promise<UserPublic | null> {
  const now = Date.now();
  if (bootstrapFailureUntil > now) return Promise.resolve(null);

  if (!bootstrapSessionPromise) {
    bootstrapSessionPromise = refreshToken()
      .then(() => getProfile())
      .then((profile) => {
        bootstrapFailureUntil = 0;
        emitAuthSession(profile);
        return profile;
      })
      .catch((err) => {
        bootstrapFailureUntil = Date.now() + BOOTSTRAP_FAILURE_COOLDOWN_MS;
        throw err;
      })
      .finally(() => {
        bootstrapSessionPromise = null;
      });
  }

  return bootstrapSessionPromise;
}

export function AuthProvider({ children, config, bootstrap = true }: { children: ReactNode; config?: Partial<AuthRuntimeConfig>; bootstrap?: boolean }) {
  if (config) configureAuth(config);

  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(bootstrap);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const onSession = (event: Event) => {
      const nextUser = (event as AuthSessionEvent).detail?.user ?? null;
      setUser(nextUser);
      setError(null);
      setLoading(false);
    };

    window.addEventListener(AUTH_SESSION_EVENT, onSession);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, onSession);
    };
  }, []);

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
    bootstrapSession()
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
          setError(null);
        }
      })
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
    bootstrapFailureUntil = 0;
    setUser(profile);
    setError(null);
    emitAuthSession(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    emitAuthSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, login, logout, reload }), [user, loading, error, login, logout, reload]);
  return (
    <AuthQueryProvider>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </AuthQueryProvider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
