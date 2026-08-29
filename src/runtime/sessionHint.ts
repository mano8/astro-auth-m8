/**
 * Best-effort local record of "this browser is known to have no session",
 * used only to decide whether `AuthProvider`'s bootstrap should skip the
 * refresh call it would otherwise make unconditionally on every page load.
 *
 * This is not a security boundary and never gates anything the identity
 * service itself decides. The actual session lives in `fa-auth-m8`'s
 * `refresh_token` cookie, which that service sets `HttpOnly`
 * (`auth_user_service/routes/login.py`), so this runtime cannot read it -
 * and, `fa-auth-m8` behaviour being out of scope for this plugin, does not
 * attempt to work around that. The hint therefore only ever records a
 * *negative*: cleared (unknown / possibly present) by default and on a
 * successful login or bootstrap, set only after a bootstrap refresh is
 * actually refused or on logout. An unset hint always attempts the refresh,
 * exactly as this runtime behaved before the hint existed, so a browser
 * carrying a still-valid cookie from before this shipped is never signed
 * out by a guess; only a browser that has already been *shown* to have no
 * session skips the next attempt. `runRefresh` and the API client's own 401
 * handling remain the real authority.
 *
 * Only called from `AuthProvider`'s bootstrap effect and its `login`/
 * `logout` callbacks, all of which run in a browser only (an effect never
 * runs during SSR; the callbacks are user-triggered), so this needs no SSR
 * guard of its own - the same reasoning `api/oauth.ts` uses `sessionStorage`
 * under.
 */

const STORAGE_KEY = "fa-auth-m8:no-session";

export function isSessionKnownAbsent(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function markSessionAbsent(): void {
  localStorage.setItem(STORAGE_KEY, "1");
}

export function markSessionPresent(): void {
  localStorage.removeItem(STORAGE_KEY);
}
