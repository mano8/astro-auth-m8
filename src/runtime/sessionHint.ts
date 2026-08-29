/**
 * Best-effort local record of "this browser is known to have no session",
 * used only to decide whether `AuthProvider`'s bootstrap should skip the
 * refresh call it would otherwise make unconditionally on every page load.
 *
 * This is not a security boundary and never gates anything the identity
 * service itself decides. The actual session lives in `fa-auth-m8`'s
 * `refresh_token` cookie, which that service sets `HttpOnly`
 * (`auth_user_service/routes/login.py`), so this runtime cannot read it -
 * and, `fa-auth-m8` behaviour being out of scope, does not work around that.
 *
 * The hint therefore only ever records a *negative*: cleared (unknown /
 * possibly present) by default and whenever a session is established, set
 * only when the service has actually refused a refresh with a `401`, or on
 * logout. An unset hint always attempts the refresh, exactly as this runtime
 * behaved before the hint existed, so a browser carrying a still-valid cookie
 * is never signed out by a guess; only a browser already shown to have no
 * session skips the next attempt. A transient failure (a `500`, an offline
 * load) must never set it, since it has no expiry. `runRefresh` and the API
 * client's own `401` handling remain the real authority.
 *
 * Written from `api/auth.ts` and `api/oauth.ts` - beside `setToken` /
 * `clearToken`, at the points that actually establish or destroy the session
 * - so every consumer is covered, including a host that builds its own
 * sign-in UI on the API wrappers instead of mounting `AuthProvider`.
 *
 * Because those are core sign-in paths, every access is guarded: a runtime
 * with no Web Storage (this package's own node-environment tests, a non-DOM
 * consumer) or one that refuses access to it (storage disabled in an
 * embedded frame) must lose the optimisation, never the sign-in.
 */

const STORAGE_KEY = "fa-auth-m8:no-session";

function store(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function isSessionKnownAbsent(): boolean {
  try {
    return store()?.getItem(STORAGE_KEY) === "1";
  } catch {
    // Unreadable storage is "unknown", which attempts the refresh - the safe
    // direction, and the behaviour that predates this hint.
    return false;
  }
}

export function markSessionAbsent(): void {
  try {
    store()?.setItem(STORAGE_KEY, "1");
  } catch {
    // Losing the write only costs one refused refresh on the next load.
  }
}

export function markSessionPresent(): void {
  try {
    store()?.removeItem(STORAGE_KEY);
  } catch {
    // Losing the clear is the dangerous direction, so it is deliberately the
    // one an unreadable store also fails into: `isSessionKnownAbsent` returns
    // false when it cannot read, so the refresh is still attempted.
  }
}
