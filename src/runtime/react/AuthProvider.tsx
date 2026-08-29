import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { configureAuth, type AuthRuntimeConfig } from "../config.js";
import { login as apiLogin, logout as apiLogout, refreshToken } from "../api/auth.js";
import { getProfile } from "../api/profile.js";
import { AUTH_REVOCATION_EVENT, type AuthRevocationDetail } from "../authEvents.js";
import { ApiError } from "../errors.js";
import { authKeys } from "../queryKeys.js";
import type { UserPublic } from "../schemas.js";
import { isSessionKnownAbsent, markSessionAbsent, markSessionPresent } from "../sessionHint.js";
import { runRefresh, setToken } from "../tokenStore.js";
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
type AuthRevocationEvent = CustomEvent<AuthRevocationDetail>;

let bootstrapSessionPromise: Promise<UserPublic | null> | null = null;
let bootstrapFailureUntil = 0;

function emitAuthSession(user: UserPublic | null) {
  /* v8 ignore next -- SSR guard: only reachable if this module runs outside a browser, which the jsdom test environment cannot simulate without corrupting the DOM globals it also depends on (see client.ts's analogous guard, tested via a separate non-jsdom file instead) */
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT, { detail: { user } }));
}

function bootstrapSession(): Promise<UserPublic | null> {
  const now = Date.now();
  if (bootstrapFailureUntil > now) return Promise.resolve(null);
  // A prior bootstrap already confirmed this browser has no session: skip
  // the refresh call outright rather than making another one fa-auth-m8 has
  // no cookie to answer. See sessionHint.ts for why this is a negative-only
  // hint and not a read of the actual (HttpOnly) cookie.
  if (isSessionKnownAbsent()) return Promise.resolve(null);

  if (!bootstrapSessionPromise) {
    // Routed through the shared `runRefresh` guard so a page mounting this
    // bootstrap alongside client.ts's own 401-triggered refresh (over one
    // expired token) issues at most one rotation, not two: whichever call
    // reaches `runRefresh` first performs the request, the other piggybacks
    // on its result. `refreshToken()` keeps its own single-flight guard for
    // callers that use it directly; nesting it under `runRefresh` here only
    // adds the cross-path coordination `runRefresh` exists for.
    bootstrapSessionPromise = runRefresh(() => refreshToken().then((token) => token.access_token))
      .then((accessToken) => {
        setToken(accessToken);
        return getProfile();
      })
      .then((profile) => {
        bootstrapFailureUntil = 0;
        markSessionPresent();
        emitAuthSession(profile);
        return profile;
      })
      .catch((err) => {
        bootstrapFailureUntil = Date.now() + BOOTSTRAP_FAILURE_COOLDOWN_MS;
        // Only a 401 proves there is no session. A 500, a timeout or an
        // offline load says nothing about the cookie, and the hint has no
        // expiry - recording "no session" from one of those would make every
        // later load skip the refresh and leave a validly signed-in user
        // looking signed out until they logged in by hand. Those keep only
        // the short `bootstrapFailureUntil` cooldown above, which lapses and
        // retries on its own, exactly as before this hint existed.
        if (err instanceof ApiError && err.status === 401) markSessionAbsent();
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

  return (
    <AuthQueryProvider>
      <AuthProviderInner bootstrap={bootstrap}>{children}</AuthProviderInner>
    </AuthQueryProvider>
  );
}

function AuthProviderInner({ children, bootstrap }: { children: ReactNode; bootstrap: boolean }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(bootstrap);
  const [error, setError] = useState<unknown>(null);

  // The identity lookup a screen's own `useProfile()` runs is a separate
  // react-query cache entry from this state; without seeding it here, a
  // screen mounting both ends up making two `me` requests for the one
  // answer this provider already has. Every place that learns the true
  // profile - bootstrap, login, reload, the cross-provider session event,
  // revocation - routes through this so `useProfile()` reads it as already
  // fresh instead of refetching.
  const applyUser = useCallback(
    (profile: UserPublic | null) => {
      setUser(profile);
      queryClient.setQueryData(authKeys.profile(), profile);
    },
    [queryClient]
  );

  useEffect(() => {
    const onSession = (event: Event) => {
      const nextUser = (event as AuthSessionEvent).detail?.user ?? null;
      applyUser(nextUser);
      setError(null);
      setLoading(false);
    };

    window.addEventListener(AUTH_SESSION_EVENT, onSession);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, onSession);
    };
  }, [applyUser]);

  const reload = useCallback(async () => {
    try {
      const profile = await getProfile();
      applyUser(profile);
      setError(null);
      return profile;
    } catch (err) {
      applyUser(null);
      setError(err);
      return null;
    }
  }, [applyUser]);

  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    setLoading(true);
    bootstrapSession()
      .then((profile) => {
        if (!cancelled) {
          applyUser(profile);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          applyUser(null);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrap, applyUser]);

  // AA-11: `revocation_enqueued: true` means the backend has already revoked the
  // target principal's sessions and is propagating an authorization-generation
  // bump. When that principal is the signed-in one, the claims held here are
  // stale the moment the response lands, so re-read the profile now instead of
  // waiting for whichever later call would incidentally refresh it. `loading`
  // is raised for the duration so `RequireRole`/`RequireAuth` fall back rather
  // than keep rendering privileged UI from the superseded claims.
  useEffect(() => {
    const currentUserId = user?.id;
    if (!currentUserId) return;

    const onRevocation = (event: Event) => {
      if ((event as AuthRevocationEvent).detail?.userId !== currentUserId) return;
      setLoading(true);
      void reload().finally(() => setLoading(false));
    };

    window.addEventListener(AUTH_REVOCATION_EVENT, onRevocation);
    return () => {
      window.removeEventListener(AUTH_REVOCATION_EVENT, onRevocation);
    };
  }, [reload, user?.id]);

  const login = useCallback(async (username: string, password: string) => {
    // `apiLogin` / `apiLogout` own the session hint (see sessionHint.ts), so
    // it is deliberately not written again here.
    await apiLogin(username, password);
    const profile = await getProfile();
    bootstrapFailureUntil = 0;
    applyUser(profile);
    setError(null);
    emitAuthSession(profile);
    return profile;
  }, [applyUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    applyUser(null);
    emitAuthSession(null);
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, login, logout, reload }), [user, loading, error, login, logout, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
