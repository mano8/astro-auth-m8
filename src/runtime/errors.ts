import { z } from "zod";

export const ApiErrorBody = z.object({
  detail: z.unknown()
});

/**
 * Derive a human-readable message from a normalized FastAPI error detail.
 * Strings are surfaced as-is; validation arrays ({ msg }) are joined; anything
 * else yields `undefined` so callers fall back to a generic message.
 */
export function messageFromDetail(detail: unknown): string | undefined {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item && (item as { msg: unknown }).msg
          ? String((item as { msg: unknown }).msg)
          : null
      )
      .filter((part): part is string => part !== null);
    if (parts.length) return parts.join("; ");
  }
  return undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? messageFromDetail(detail) ?? "Auth API request failed");
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, message, message);
    this.name = "UnauthenticatedError";
  }
}

export function normalizeFastApiError(payload: unknown): unknown {
  const parsed = ApiErrorBody.safeParse(payload);
  return parsed.success ? parsed.data.detail : payload;
}

/**
 * An operator-facing error presentation: a short labelled `title` plus an
 * optional `description` with more detail. Never contains a raw backend
 * detail token (e.g. `last_superuser_required`) as the `title` - only as a
 * verbatim `description` where the contract guarantees it is free text meant
 * for display (the `400` retention-floor case).
 */
export interface ApiErrorPresentation {
  title: string;
  description?: string;
}

const LAST_SUPERUSER_REQUIRED = "last_superuser_required";

/**
 * Maps one `fa-auth-m8` status to its operator-facing presentation. `detail` is
 * the response detail only when it is a string, since every mapping that reads
 * it needs display text. Returning `undefined` means "this status has no
 * special meaning for this detail" and hands the error back to the generic
 * fallback chain - which is how an unrelated `409` (e.g. a duplicate email)
 * keeps its own message instead of being mislabelled.
 */
type ApiErrorPresenter = (detail: string | undefined, fallback: string) => ApiErrorPresentation | undefined;

/**
 * One entry per mapped status. Kept as a table rather than a chain of `if`s so
 * a new contract is a new row, and so each mapping can be read - and reviewed
 * against the backend route that produces it - on its own.
 */
const API_ERROR_PRESENTERS = new Map<number, ApiErrorPresenter>([
  [400, (detail) => (detail ? { title: "Rejected", description: detail } : undefined)],
  // Titled by status, not by cause: every mapped surface can produce a 403
  // (a role change refused as self-promotion, but also an audit-log read or a
  // purge attempted by a principal demoted since the page loaded), and the
  // detail string that would distinguish them is not a stable contract. The
  // backend's own 403 detail is already operator-readable ("A user may not
  // raise their own role"), so it carries the specific cause as the
  // description while the title never asserts one that may be wrong.
  [403, (detail, fallback) => ({ title: "Not permitted", description: detail ?? fallback })],
  [
    409,
    (detail) =>
      detail === LAST_SUPERUSER_REQUIRED
        ? {
            title: "Last superuser required",
            description:
              "This is the only remaining superuser account, so it can't be changed or removed."
          }
        : undefined
  ],
  [
    429,
    () => ({
      title: "Too many requests",
      description: "Try again later - this action was not attempted."
    })
  ],
  [
    503,
    () => ({
      title: "Temporarily unavailable",
      description:
        "The outcome of this action is unknown. Do not retry until you've confirmed its status."
    })
  ]
]);

/**
 * Map a `fa-auth-m8` 2.0.0 authorization/rate-limit/retention error to an
 * operator-readable presentation. Covers the role-change error contracts
 * shared by `PATCH /users/update/{id}/` and `DELETE /users/delete/{id}/`
 * (403 self-promotion, 409 `last_superuser_required`) plus the rate-limit and
 * retention-floor contracts every new admin surface (audit log, both purges)
 * shares with them, so callers do not each re-derive these mappings:
 *
 * - `403` - not permitted (e.g. a role change refused as self-promotion, or a
 *   privileged read/purge attempted without the tier). Titled by status, since
 *   several mapped surfaces produce a `403` and the detail that would tell them
 *   apart is not a stable contract; the backend's own readable detail carries
 *   the specific cause.
 * - `409` with detail `last_superuser_required` - the raw token is never
 *   surfaced; replaced with a labelled explanation.
 * - `429` - rate limited. The action was not attempted; safe to retry later,
 *   never automatically.
 * - `503` - fail-closed rate limiting (e.g. Redis unavailable). Unlike `429`,
 *   the action's outcome is *unknown* - the message must not imply failure,
 *   and callers must not auto-retry (a retry could double an already-applied
 *   effect).
 * - `400` - e.g. a purge's retention-floor rejection. The detail is free
 *   text (`str(exc)`) and is surfaced verbatim under a labelled heading,
 *   never pattern-matched into a token, since it is not a stable contract.
 *
 * Anything else falls back to the error's own message, then `fallback`.
 */
export function describeApiError(error: unknown, fallback: string): ApiErrorPresentation {
  if (error instanceof ApiError) {
    const detail = typeof error.detail === "string" ? error.detail : undefined;
    const presented = API_ERROR_PRESENTERS.get(error.status)?.(detail, fallback);
    if (presented) return presented;
  }

  if (error instanceof Error && error.message) {
    return { title: error.message };
  }

  return { title: fallback };
}
