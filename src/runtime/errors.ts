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
 * Map a `fa-auth-m8` 2.0.0 authorization/rate-limit/retention error to an
 * operator-readable presentation. Covers the role-change error contracts
 * shared by `PATCH /users/update/{id}/` and `DELETE /users/delete/{id}/`
 * (403 self-promotion, 409 `last_superuser_required`) plus the rate-limit and
 * retention-floor contracts every new admin surface (audit log, both purges)
 * shares with them, so callers do not each re-derive these mappings:
 *
 * - `403` - self-promotion: the backend's own detail text is already
 *   operator-readable, just labelled.
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

    if (error.status === 403) {
      return { title: "Role change not allowed", description: detail ?? fallback };
    }

    if (error.status === 409 && detail === LAST_SUPERUSER_REQUIRED) {
      return {
        title: "Last superuser required",
        description:
          "This is the only remaining superuser account, so it can't be changed or removed.",
      };
    }

    if (error.status === 429) {
      return {
        title: "Too many requests",
        description: "Try again later - this action was not attempted.",
      };
    }

    if (error.status === 503) {
      return {
        title: "Temporarily unavailable",
        description:
          "The outcome of this action is unknown. Do not retry until you've confirmed its status.",
      };
    }

    if (error.status === 400 && detail) {
      return { title: "Rejected", description: detail };
    }
  }

  if (error instanceof Error && error.message) {
    return { title: error.message };
  }

  return { title: fallback };
}
