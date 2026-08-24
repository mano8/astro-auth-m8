// An in-memory stand-in for `fa-auth-m8`, for the dev-only gallery.
//
// The gallery mounts the plugin's *real* views, so it needs a real transport:
// the views call hooks, the hooks call the api wrappers, and those wrappers
// `fetch` and then `schema.parse()` the response. Stubbing `fetch` is therefore
// the only seam that leaves every layer above it genuine — mock the hooks
// instead and the gallery stops showing the plugin and starts showing the mock.
//
// The signed-in user is switchable, because this plugin's views are mostly
// *about* who is signed in: the account view, the role guards and the admin
// surfaces all render differently per role, and a gallery pinned to one
// session would show one of them.
import type { UserPublic } from "../../../src/runtime/schemas.js";

const NOW = "2026-08-24T09:00:00Z";

export type StubSession = "anonymous" | "user" | "superuser";

const USERS: Record<Exclude<StubSession, "anonymous">, UserPublic> = {
  user: {
    id: "44444444-4444-4444-8444-444444444444",
    provider: "password",
    email: "reader@example.test",
    full_name: "Sample Reader",
    avatar: null,
    is_active: true,
    email_verified: true,
    is_superuser: false,
    role: "user",
    created_at: NOW,
    updated_at: NOW
  },
  superuser: {
    id: "55555555-5555-4555-8555-555555555555",
    provider: "password",
    email: "admin@example.test",
    full_name: "Sample Admin",
    avatar: null,
    is_active: true,
    email_verified: true,
    is_superuser: true,
    role: "superadmin",
    created_at: NOW,
    updated_at: NOW
  }
};

let session: StubSession = "user";

/** Switches the session the stub reports; the gallery re-mounts after this. */
export function setStubSession(next: StubSession): void {
  session = next;
}

export function getStubSession(): StubSession {
  return session;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function currentUser(): UserPublic | null {
  return session === "anonymous" ? null : USERS[session];
}

/**
 * Replaces `globalThis.fetch` for the lifetime of the gallery page. Returns the
 * original so a caller can restore it.
 */
export function installServiceStub(): typeof globalThis.fetch {
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.origin
    );
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    // Latency, so the loading states in the gallery are reachable rather than
    // theoretical.
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (path.endsWith("/meta")) {
      return json({
        contract_name: "fa-auth-m8",
        contract_version: "2.0",
        service_version: "2.0.3",
        service_name: "fa-auth-m8"
      });
    }
    if (path.endsWith("/health/")) return json({ success: true, msg: "ok" });

    // The provider bootstraps a session with refresh-then-profile. An
    // anonymous stub must fail the refresh, which is the signed-out path the
    // login view exists for.
    if (path.includes("/login/refresh-token/")) {
      const user = currentUser();
      return user === null
        ? json({ detail: "Not authenticated" }, 401)
        : json({ success: true, msg: "refreshed" });
    }

    if (path.includes("/login/access-token")) {
      session = "user";
      return json({ success: true, msg: "signed in" });
    }
    if (path.includes("/login/logout/")) {
      session = "anonymous";
      return json({ success: true, msg: "signed out" });
    }

    if (path.includes("/profile/get/me/")) {
      const user = currentUser();
      return user === null ? json({ detail: "Not authenticated" }, 401) : json(user);
    }

    if (path.includes("/profile/api-keys/")) {
      return json({ data: [], count: 0 });
    }

    if (path.includes("/sessions/get-current/")) {
      return json({
        id: "session-1",
        provider: "password",
        jwt_jti: "jti-1",
        jwt_expires_at: NOW,
        refresh_expires_at: NOW,
        revoked: false,
        external_token_expires_at: null,
        created_at: NOW,
        updated_at: NOW
      });
    }
    if (path.includes("/sessions/")) {
      return json({ data: [], count: 0 });
    }

    if (path.includes("/users/")) {
      const user = currentUser();
      return json({ data: user === null ? [] : [user], count: user === null ? 0 : 1 });
    }

    if (path.includes("/dashboard/") || path.includes("/security/")) {
      return json({ data: [], count: 0 });
    }

    // Anything unrecognised answers 404 rather than hanging, so a gap in the
    // stub shows up as the plugin's own error surface instead of a spinner.
    return json({ detail: `No gallery stub for ${method} ${path}` }, 404);
  }) as typeof globalThis.fetch;

  return original;
}
