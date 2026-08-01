/**
 * Browser notifications the auth runtime uses to tell a mounted `AuthProvider`
 * about an authorization change that did not originate from it.
 *
 * Kept in a plain runtime module rather than the provider component so the
 * headless hook layer can announce one without importing React UI code, and so
 * a consumer with its own mutation layer can announce one too (re-exported from
 * `@mano8/astro-auth-m8/react`).
 */

export const AUTH_REVOCATION_EVENT = "fa-auth-m8:revocation";

export type AuthRevocationDetail = { userId: string };

/**
 * Announce that `fa-auth-m8` answered an authorization change with
 * `revocation_enqueued: true` for `userId` (AA-11): that principal's sessions
 * have been revoked and its authorization generation is being bumped, so any
 * client state describing its privileges is already stale.
 *
 * This is a notification, not a decision - each listener judges whether the id
 * concerns it, and the backend stays the authority either way. No-op outside a
 * browser.
 */
export function emitAuthRevocation(userId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AuthRevocationDetail>(AUTH_REVOCATION_EVENT, { detail: { userId } })
  );
}
