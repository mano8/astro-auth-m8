// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

const authApi = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), refreshToken: vi.fn() }));
const profileApi = vi.hoisted(() => ({ deleteProfile: vi.fn(), getProfile: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn() }));
const apiKeyApi = vi.hoisted(() => ({ listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn(), adminListUserApiKeys: vi.fn(), adminRevokeApiKey: vi.fn() }));
const dashboardApi = vi.hoisted(() => ({ getGlobalActivity: vi.fn(), getUserActivity: vi.fn() }));
const securityApi = vi.hoisted(() => ({ getAuditLog: vi.fn(), purgeAuditLog: vi.fn(), purgeApiKeys: vi.fn() }));
const sessionApi = vi.hoisted(() => ({ getCurrentSession: vi.fn(), listSessions: vi.fn(), revokeSession: vi.fn() }));
const userApi = vi.hoisted(() => ({ createUser: vi.fn(), deleteUser: vi.fn(), getUser: vi.fn(), listUsers: vi.fn(), signupUser: vi.fn(), updateUser: vi.fn() }));
const oauthApi = vi.hoisted(() => ({ createPkcePair: vi.fn(), getGoogleLoginUrl: vi.fn(), savePkceVerifier: vi.fn(), exchangeGoogleCode: vi.fn(), takePkceVerifier: vi.fn() }));

vi.mock("../src/runtime/api/auth.js", () => authApi);
vi.mock("../src/runtime/api/profile.js", () => profileApi);
vi.mock("../src/runtime/api/apiKeys.js", () => apiKeyApi);
vi.mock("../src/runtime/api/dashboard.js", () => dashboardApi);
vi.mock("../src/runtime/api/security.js", () => securityApi);
vi.mock("../src/runtime/api/sessions.js", () => sessionApi);
vi.mock("../src/runtime/api/users.js", () => userApi);
vi.mock("../src/runtime/api/oauth.js", () => oauthApi);

import { AUTH_REVOCATION_EVENT, AuthProvider, AuthQueryProvider, emitAuthRevocation, ORDERED_ROLES, hasMinimumRole, hasSuperuserPrivileges, privilegeClaimsAreConsistent, RequireAuth, RequireRole, useAuth } from "../src/runtime/react/index.js";
import * as authorizationModule from "../src/runtime/authorization.js";
import { AccountView, CallbackView, LoginForm, LoginView, SignupView, StarterAccountPage, StarterLoginPage } from "../src/runtime/react/default-ui/index.js";
import { useAdminApiKeys, useApiKeys } from "../src/runtime/hooks/useApiKeys.js";
import { useDashboard } from "../src/runtime/hooks/useDashboard.js";
import { useGoogleLogin } from "../src/runtime/hooks/useGoogleLogin.js";
import { useProfile } from "../src/runtime/hooks/useProfile.js";
import { useAuditLog, useSecurityPurges } from "../src/runtime/hooks/useSecurity.js";
import { useSessions } from "../src/runtime/hooks/useSessions.js";
import { useUsers } from "../src/runtime/hooks/useUsers.js";
import { authKeys } from "../src/runtime/queryKeys.js";
import { getAuthConfig, resetAuthConfig } from "../src/runtime/config.js";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  provider: "password" as const,
  email: "ada@example.com",
  full_name: "Ada",
  avatar: null,
  is_active: true,
  email_verified: true,
  is_superuser: true,
  role: "superadmin" as const
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function flush() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
      await flush();
    }
  }
  throw lastError;
}

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  return {
    container,
    unmount: () => act(() => root.unmount())
  };
}

function HookProbe<T>({ hook, expose }: { hook: () => T; expose: (value: T) => void }) {
  const value = hook();
  expose(value);
  return null;
}

function HookHarness({ children }: { children: ReactNode }) {
  const [client] = React.useState(() => createTestQueryClient());
  return <AuthQueryProvider client={client}>{children}</AuthQueryProvider>;
}

function HookHarnessWithClient({ children, client }: { children: ReactNode; client: QueryClient }) {
  return <AuthQueryProvider client={client}>{children}</AuthQueryProvider>;
}

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function QueryClientProbe({ expose }: { expose: (client: QueryClient) => void }) {
  const client = useQueryClient();
  expose(client);
  return null;
}

beforeEach(() => {
  resetAuthConfig();
  vi.clearAllMocks();
  authApi.login.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  authApi.logout.mockResolvedValue({ message: "bye" });
  authApi.refreshToken.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  profileApi.getProfile.mockResolvedValue(user);
  profileApi.updateProfile.mockResolvedValue({ success: true, user });
  profileApi.updatePassword.mockResolvedValue({ message: "password changed" });
  profileApi.deleteProfile.mockResolvedValue({ message: "deleted" });
  apiKeyApi.listApiKeys.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111112", name: "key", expires_at: null, revoked: false, last_used_at: null }]);
  apiKeyApi.createApiKey.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111113", name: "new", expires_at: null, revoked: false, last_used_at: null, plaintext: "secret" });
  apiKeyApi.revokeApiKey.mockResolvedValue({ message: "revoked" });
  apiKeyApi.adminListUserApiKeys.mockResolvedValue({
    data: [{ id: "11111111-1111-4111-8111-111111111115", name: "admin-key", user_id: user.id, revoked: false, expires_at: null, last_used_at: null, created_at: "2026-06-15T00:00:00Z", access_mode: "read_only", status: "active", audiences: [] }],
    count: 1
  });
  apiKeyApi.adminRevokeApiKey.mockResolvedValue({ message: "revoked" });
  securityApi.getAuditLog.mockResolvedValue({
    data: [{ id: "11111111-1111-4111-8111-111111111116", created_at: "2026-06-15T00:00:00Z", actor_user_id: user.id, actor_role: "superadmin", action: "delete", table_name: "m8_api_key", row_pk: "11111111-1111-4111-8111-111111111115", target_owner_id: user.id }],
    count: 1
  });
  securityApi.purgeAuditLog.mockResolvedValue({ window: "1m", removed: 3 });
  securityApi.purgeApiKeys.mockResolvedValue({ window: "1m", removed: 2 });
  dashboardApi.getUserActivity.mockResolvedValue({ nb_users: 1, activity: { min: 0, max: 1, activity: [] } });
  dashboardApi.getGlobalActivity.mockResolvedValue({ nb_users: 2, activity: { min: 0, max: 2, activity: [] } });
  sessionApi.getCurrentSession.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111114", provider: "password", user_agent: null, ip_address: null, created_at: "2026-06-25T10:00:00Z", last_seen_at: "2026-06-25T10:00:00Z", expires_at: "2026-06-26T10:00:00Z" });
  sessionApi.listSessions.mockResolvedValue({ data: [], count: 0 });
  sessionApi.revokeSession.mockResolvedValue({ message: "revoked" });
  userApi.createUser.mockResolvedValue(user);
  userApi.signupUser.mockResolvedValue(user);
  userApi.getUser.mockResolvedValue(user);
  userApi.listUsers.mockResolvedValue({ data: [user], count: 1 });
  userApi.updateUser.mockResolvedValue(user);
  userApi.deleteUser.mockResolvedValue({ message: "deleted" });
  oauthApi.createPkcePair.mockResolvedValue({ verifier: "verifier", challenge: "challenge" });
  oauthApi.getGoogleLoginUrl.mockResolvedValue({ url: "https://accounts.test" });
  oauthApi.takePkceVerifier.mockReturnValue("verifier");
  oauthApi.exchangeGoogleCode.mockResolvedValue({ version: 1, auth_provider: "google", access_token: "token", expires_at: 1, user: { email: "ada@example.com" } });
  Object.defineProperty(window, "location", { value: { href: "https://app.test/auth/callback?code=abc", assign: vi.fn() }, writable: true });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AuthProvider and guards", () => {
  it("applies runtime config before children bootstrap or render", () => {
    let apiBaseDuringChildRender = "";

    function ConfigProbe() {
      apiBaseDuringChildRender = getAuthConfig().apiBase;
      return null;
    }

    const view = render(
      <AuthProvider config={{ apiBase: "/session-api" }} bootstrap={false}>
        <ConfigProbe />
      </AuthProvider>
    );

    expect(apiBaseDuringChildRender).toBe("/session-api");
    view.unmount();
  });

  it("creates one stable query client and supports injected or parent-owned clients", async () => {
    const seenClients: QueryClient[] = [];
    const customClient = new QueryClient();
    const parentClient = new QueryClient();

    function StableProbe() {
      const [, setTick] = React.useState(0);
      const client = useQueryClient();
      seenClients.push(client);
      return <button onClick={() => setTick((value) => value + 1)}>rerender</button>;
    }

    let providedClient: QueryClient | undefined;
    let inheritedClient: QueryClient | undefined;

    const stableView = render(<AuthQueryProvider><StableProbe /></AuthQueryProvider>);
    await flush();
    act(() => {
      stableView.container.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(seenClients).toHaveLength(2);
    expect(seenClients[0]).toBe(seenClients[1]);
    stableView.unmount();

    const customView = render(<AuthQueryProvider client={customClient}><QueryClientProbe expose={(client) => { providedClient = client; }} /></AuthQueryProvider>);
    await flush();
    expect(providedClient).toBe(customClient);
    customView.unmount();

    const nestedView = render(
      <QueryClientProvider client={parentClient}>
        <AuthQueryProvider client={customClient}>
          <QueryClientProbe expose={(client) => { inheritedClient = client; }} />
        </AuthQueryProvider>
      </QueryClientProvider>
    );
    await flush();
    expect(inheritedClient).toBe(parentClient);
    nestedView.unmount();
  });

  it("bootstraps, logs in, reloads, logs out, and renders guards", async () => {
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <><span>{auth.user?.email ?? "none"}</span><RequireAuth fallback={<b>fallback</b>}><i>private</i></RequireAuth><RequireRole roles={["admin"]}><u>role</u></RequireRole><RequireRole superuser><em>super</em></RequireRole></>;
    }
    const view = render(<AuthProvider config={{ apiBase: "/api" }}><Probe /></AuthProvider>);
    await flush();
    expect(view.container.textContent).toContain("private");
    expect(view.container.textContent).toContain("role");
    expect(view.container.textContent).toContain("super");
    await act(async () => { await auth!.login("ada@example.com", "password"); });
    expect(authApi.login).toHaveBeenCalledWith("ada@example.com", "password");
    await act(async () => { await auth!.reload(); });
    await act(async () => { await auth!.logout(); });
    expect(authApi.logout).toHaveBeenCalled();
    view.unmount();
  });

  it("denies superuser UI for an inconsistent role/is_superuser pair", async () => {
    profileApi.getProfile.mockResolvedValueOnce({ ...user, role: "admin" as const, is_superuser: true });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <RequireRole superuser fallback={<b>denied</b>}><em>super</em></RequireRole>;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user).not.toBeNull());
    expect(view.container.textContent).toContain("denied");
    expect(view.container.textContent).not.toContain("super");
    view.unmount();
  });

  it("admits a superadmin to a role guard requiring a lower tier", async () => {
    profileApi.getProfile.mockResolvedValueOnce({ ...user, role: "superadmin" as const, is_superuser: true });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <RequireRole roles={["admin"]} fallback={<b>denied</b>}><u>role</u></RequireRole>;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user).not.toBeNull());
    expect(view.container.textContent).toContain("role");
    expect(view.container.textContent).not.toContain("denied");
    view.unmount();
  });

  it("re-reads the signed-in principal's claims when its authorization is revoked", async () => {
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <><span>{auth.user?.role ?? "none"}</span><RequireRole superuser fallback={<b>denied</b>}><em>super</em></RequireRole></>;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user).not.toBeNull());
    expect(view.container.textContent).toContain("super");
    expect(profileApi.getProfile).toHaveBeenCalledTimes(1);

    // The demotion the operator just applied elsewhere: the provider must pick
    // up the new claims from the notification, not from the next incidental
    // profile read, and the superuser UI must be gone once it has.
    profileApi.getProfile.mockResolvedValueOnce({ ...user, role: "user" as const, is_superuser: false });
    await act(async () => { emitAuthRevocation(user.id); });
    await waitFor(() => expect(auth!.user?.role).toBe("user"));
    expect(profileApi.getProfile).toHaveBeenCalledTimes(2);
    expect(auth!.loading).toBe(false);
    expect(view.container.textContent).toContain("denied");
    expect(view.container.textContent).not.toContain("super");
    view.unmount();
  });

  it("ignores revocations aimed at another principal or carrying no detail", async () => {
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return null;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user).not.toBeNull());
    expect(profileApi.getProfile).toHaveBeenCalledTimes(1);

    await act(async () => { emitAuthRevocation("22222222-2222-4222-8222-222222222222"); });
    await act(async () => { window.dispatchEvent(new Event(AUTH_REVOCATION_EVENT)); });
    await flush();
    expect(profileApi.getProfile).toHaveBeenCalledTimes(1);
    expect(auth!.user?.role).toBe("superadmin");
    view.unmount();
  });

  it("handles bootstrap and reload errors, disabled bootstrap, fallback branches, and missing provider", async () => {
    profileApi.getProfile.mockRejectedValueOnce(new Error("profile failed"));
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <><RequireAuth fallback={<b>fallback</b>}><i>private</i></RequireAuth><RequireRole roles={["reader"]} fallback={<span>no role</span>}><u>role</u></RequireRole></>;
    }
    const view = render(<AuthProvider bootstrap={false}><Probe /></AuthProvider>);
    expect(view.container.textContent).toContain("fallback");
    await act(async () => { expect(await auth!.reload()).toBeNull(); });
    expect(auth!.error).toBeInstanceOf(Error);
    view.unmount();
    function BareProbe() {
      useAuth();
      return null;
    }
    expect(() => render(<BareProbe />)).toThrow("useAuth must be used inside AuthProvider");
  });

  it("dedupes concurrent bootstrap calls behind a single in-flight promise", async () => {
    let authA: ReturnType<typeof useAuth> | undefined;
    let authB: ReturnType<typeof useAuth> | undefined;
    function ProbeA() {
      authA = useAuth();
      return null;
    }
    function ProbeB() {
      authB = useAuth();
      return null;
    }
    const view = render(
      <>
        <AuthProvider><ProbeA /></AuthProvider>
        <AuthProvider><ProbeB /></AuthProvider>
      </>
    );
    await waitFor(() => {
      expect(authA!.loading).toBe(false);
      expect(authB!.loading).toBe(false);
    });
    expect(authApi.refreshToken).toHaveBeenCalledTimes(1);
    expect(authA!.user?.email).toBe("ada@example.com");
    expect(authB!.user?.email).toBe("ada@example.com");
    view.unmount();
  });

  it("skips state updates for a bootstrap outcome that lands after unmount", async () => {
    let rejectRefresh: (err: unknown) => void = () => {};
    authApi.refreshToken.mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return null;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    view.unmount();
    await act(async () => {
      rejectRefresh(new Error("late bootstrap failure"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const cleanup = render(<AuthProvider bootstrap={false}><Probe /></AuthProvider>);
    await act(async () => { await auth!.login("ada@example.com", "password"); });
    cleanup.unmount();
  });

  it("enters a failure cooldown after a failed bootstrap, then skips retry until it lapses", async () => {
    authApi.refreshToken.mockRejectedValueOnce(new Error("bootstrap failed"));
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <span>{auth.loading ? "loading" : (auth.error ? "errored" : "ready")}</span>;
    }
    const first = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.loading).toBe(false));
    expect(auth!.error).toBeInstanceOf(Error);
    expect(auth!.user).toBeNull();
    first.unmount();

    authApi.refreshToken.mockClear();
    const second = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.loading).toBe(false));
    expect(authApi.refreshToken).not.toHaveBeenCalled();
    expect(auth!.user).toBeNull();
    await act(async () => { await auth!.login("ada@example.com", "password"); });
    second.unmount();
  });
});

describe("RequireRole minimum-role mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthConfig();
    authApi.refreshToken.mockResolvedValue({ access_token: "token" });
    profileApi.getProfile.mockResolvedValue(user);
  });

  afterEach(() => {
    resetAuthConfig();
  });

  // The re-export is the whole point of the item: a consumer gating something
  // that is not a subtree must be able to reach the comparison from the same
  // subpath it imports the guard from. Identity, not just presence - a second
  // copy of the hierarchy is exactly what `RBAC-06` forbids.
  it("re-exports the authorization primitives as the same bindings", () => {
    expect(hasMinimumRole).toBe(authorizationModule.hasMinimumRole);
    expect(hasSuperuserPrivileges).toBe(authorizationModule.hasSuperuserPrivileges);
    expect(privilegeClaimsAreConsistent).toBe(authorizationModule.privilegeClaimsAreConsistent);
    expect(ORDERED_ROLES).toBe(authorizationModule.ORDERED_ROLES);
    expect(ORDERED_ROLES).toEqual(["superadmin", "admin", "writer", "reader", "user"]);
  });

  // The full matrix: every role against every floor, so `minimumRole` is proven
  // to be the ordered comparison and not exact membership. A `superadmin` must
  // clear every floor - the bug the hierarchy exists to prevent is an admin
  // surface hidden from the one account that outranks it.
  it.each(
    ORDERED_ROLES.flatMap((role) =>
      ORDERED_ROLES.map((floor) => ({
        role,
        floor,
        granted: ORDERED_ROLES.indexOf(role) <= ORDERED_ROLES.indexOf(floor)
      }))
    )
  )("renders $granted for role $role against minimumRole $floor", async ({ role, floor, granted }) => {
    profileApi.getProfile.mockResolvedValue({ ...user, role, is_superuser: role === "superadmin" });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <RequireRole minimumRole={floor} fallback={<b>denied</b>}><u>granted</u></RequireRole>;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user?.role).toBe(role));
    expect(view.container.textContent).toBe(granted ? "granted" : "denied");
    view.unmount();
  });

  it("matches the roles-array spelling of the same floor", async () => {
    profileApi.getProfile.mockResolvedValue({ ...user, role: "admin" as const, is_superuser: false });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return (
        <>
          <RequireRole minimumRole="writer" fallback={<b>denied-min</b>}><u>granted-min</u></RequireRole>
          <RequireRole roles={["writer"]} fallback={<b>denied-array</b>}><u>granted-array</u></RequireRole>
        </>
      );
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user?.role).toBe("admin"));
    expect(view.container.textContent).toBe("granted-mingranted-array");
    view.unmount();
  });

  // The modes are a union, so a guard carrying both grants on either. The
  // second case is the one that matters: a `superadmin` whose `is_superuser`
  // disagrees fails the dual-evidence gate and is still admitted by the role
  // floor, which is correct - `minimumRole` makes no claim about the flag.
  it("grants on either mode when a guard carries both", async () => {
    profileApi.getProfile.mockResolvedValue({ ...user, role: "reader" as const, is_superuser: false });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <RequireRole superuser minimumRole="reader" fallback={<b>denied</b>}><u>granted</u></RequireRole>;
    }
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user?.role).toBe("reader"));
    expect(view.container.textContent).toBe("granted");
    view.unmount();
  });

  // Fail closed on every state that is not a satisfied mode: no mode at all,
  // an unresolved session, and an anonymous one.
  it("falls back for an unqualified guard, a loading session, and an anonymous session", async () => {
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      auth = useAuth();
      return <RequireRole fallback={<b>denied</b>}><u>granted</u></RequireRole>;
    }
    const qualified = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth!.user?.role).toBe("superadmin"));
    expect(qualified.container.textContent).toBe("denied");
    qualified.unmount();

    function MinProbe() {
      auth = useAuth();
      return <RequireRole minimumRole="user" fallback={<b>denied</b>}><u>granted</u></RequireRole>;
    }
    const loading = render(<AuthProvider><MinProbe /></AuthProvider>);
    expect(loading.container.textContent).toBe("denied");
    await waitFor(() => expect(auth!.user?.role).toBe("superadmin"));
    expect(loading.container.textContent).toBe("granted");
    loading.unmount();

    profileApi.getProfile.mockRejectedValue(new Error("anonymous"));
    authApi.refreshToken.mockRejectedValue(new Error("anonymous"));
    const anonymous = render(<AuthProvider><MinProbe /></AuthProvider>);
    await waitFor(() => expect(auth!.loading).toBe(false));
    expect(auth!.user).toBeNull();
    expect(anonymous.container.textContent).toBe("denied");
    anonymous.unmount();
  });
});

describe("hooks", () => {
  it("covers profile hook success and error paths", async () => {
    let hook: ReturnType<typeof useProfile>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const removeSpy = vi.spyOn(client, "removeQueries");
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useProfile(false)} expose={(v) => { hook = v; }} /></HookHarnessWithClient>);
    await act(async () => { await hook!.reload(); });
    await waitFor(() => expect(hook!.profile?.email).toBe("ada@example.com"));
    expect(hook!.loading).toBe(false);
    await act(async () => { await hook!.save({ full_name: "Ada" }); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.profile() });
    await act(async () => { await hook!.changePassword({ current_password: "password1", new_password: "password2" }); });
    await act(async () => { await hook!.remove(); });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: authKeys.profile(), exact: true });
    profileApi.getProfile.mockRejectedValueOnce(new Error("boom"));
    await act(async () => { await expect(hook!.reload()).rejects.toThrow("boom"); });
    view.unmount();
  });

  it("covers API key hook success and error paths", async () => {
    let hook: ReturnType<typeof useApiKeys>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useApiKeys(false)} expose={(v) => { hook = v; }} /></HookHarnessWithClient>);
    await act(async () => { await hook!.reload(); });
    await waitFor(() => expect(hook!.apiKeys).toHaveLength(1));
    await act(async () => { await hook!.create({ ttl_hours: 1 }); });
    await waitFor(() => expect(hook!.createdKey?.plaintext).toBe("secret"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.apiKeys() });
    await act(async () => { await hook!.revoke("id"); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.apiKeys() });
    apiKeyApi.listApiKeys.mockRejectedValueOnce(new Error("keys failed"));
    await act(async () => { await expect(hook!.reload()).rejects.toThrow("keys failed"); });
    view.unmount();
  });

  it("covers dashboard, users, and sessions hooks", async () => {
    let dash: ReturnType<typeof useDashboard>;
    let globalDash: ReturnType<typeof useDashboard>;
    let usersHook: ReturnType<typeof useUsers>;
    let sessionsHook: ReturnType<typeof useSessions>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useDashboard("me", false)} expose={(v) => { dash = v; }} /><HookProbe hook={() => useDashboard("global", false)} expose={(v) => { globalDash = v; }} /><HookProbe hook={() => useUsers(false)} expose={(v) => { usersHook = v; }} /><HookProbe hook={() => useSessions(false)} expose={(v) => { sessionsHook = v; }} /></HookHarnessWithClient>);
    const firstDashReload = dash!.reload;
    const firstGlobalDashReload = globalDash!.reload;
    const firstUsersReload = usersHook!.reload;
    const firstSessionsReload = sessionsHook!.reload;
    const firstCurrentSessionReload = sessionsHook!.reloadCurrent;
    await act(async () => { await dash!.reload(); await globalDash!.reload(); await usersHook!.reload(); await sessionsHook!.reload(); await sessionsHook!.reloadCurrent(); });
    await waitFor(() => {
      expect(dash!.activity?.nb_users).toBe(1);
      expect(globalDash!.activity?.nb_users).toBe(2);
      expect(usersHook!.users?.count).toBe(1);
      expect(sessionsHook!.sessions?.count).toBe(0);
      expect(sessionsHook!.current?.id).toBe("11111111-1111-4111-8111-111111111114");
    });
    expect(dash!.reload).toBe(firstDashReload);
    expect(globalDash!.reload).toBe(firstGlobalDashReload);
    expect(usersHook!.reload).toBe(firstUsersReload);
    expect(sessionsHook!.reload).toBe(firstSessionsReload);
    expect(sessionsHook!.reloadCurrent).toBe(firstCurrentSessionReload);
    await act(async () => { await usersHook!.get(user.id); });
    expect(userApi.getUser).toHaveBeenCalledWith(user.id);
    await act(async () => { await usersHook!.create({ provider: "password", email: "ada@example.com", password: "password1" }); });
    await act(async () => { await usersHook!.signup({ email: "ada@example.com", password: "password1" }); });
    await act(async () => { await usersHook!.update(user.id, { full_name: "Ada Lovelace" }); });
    await act(async () => { await usersHook!.remove(user.id); });
    await act(async () => { await sessionsHook!.revoke("session-id"); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.users() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.user(user.id) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.sessions() });
    dashboardApi.getUserActivity.mockRejectedValueOnce(new Error("dash failed"));
    userApi.listUsers.mockRejectedValueOnce(new Error("users failed"));
    sessionApi.listSessions.mockRejectedValueOnce(new Error("sessions failed"));
    await act(async () => { await expect(dash!.reload()).rejects.toThrow("dash failed"); });
    await act(async () => { await expect(usersHook!.reload()).rejects.toThrow("users failed"); });
    await act(async () => { await expect(sessionsHook!.reload()).rejects.toThrow("sessions failed"); });
    view.unmount();
  });

  it("drops the authorization caches and notifies the provider on a revoking update", async () => {
    let usersHook: ReturnType<typeof useUsers>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const revocations: string[] = [];
    const onRevocation = (event: Event) => {
      revocations.push((event as CustomEvent<{ userId: string }>).detail.userId);
    };
    window.addEventListener(AUTH_REVOCATION_EVENT, onRevocation);
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useUsers(false)} expose={(v) => { usersHook = v; }} /></HookHarnessWithClient>);

    userApi.updateUser.mockResolvedValueOnce({ ...user, role: "user", is_superuser: false, auth_generation: 4, revocation_enqueued: true });
    await act(async () => { await usersHook!.update(user.id, { role: "user" }); });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.profile() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.sessions() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.apiKeys() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.adminApiKeys(user.id) });
    expect(revocations).toEqual([user.id]);

    // An update the backend did not revoke anything for leaves the
    // session-scoped caches (and the provider) alone.
    invalidateSpy.mockClear();
    userApi.updateUser.mockResolvedValueOnce({ ...user, auth_generation: 4, revocation_enqueued: false });
    await act(async () => { await usersHook!.update(user.id, { full_name: "Ada Lovelace" }); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.users() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: authKeys.profile() });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: authKeys.sessions() });
    expect(revocations).toEqual([user.id]);

    window.removeEventListener(AUTH_REVOCATION_EVENT, onRevocation);
    view.unmount();
  });

  it("covers the admin API-key hook success and error paths", async () => {
    let hook: ReturnType<typeof useAdminApiKeys>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useAdminApiKeys(user.id, false)} expose={(v) => { hook = v; }} /></HookHarnessWithClient>);
    await act(async () => { await hook!.reload(); });
    await waitFor(() => expect(hook!.apiKeys).toHaveLength(1));
    expect(hook!.count).toBe(1);
    await act(async () => { await hook!.revoke("11111111-1111-4111-8111-111111111115"); });
    expect(apiKeyApi.adminRevokeApiKey.mock.calls[0][0]).toBe("11111111-1111-4111-8111-111111111115");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.adminApiKeys(user.id) });
    apiKeyApi.adminListUserApiKeys.mockRejectedValueOnce(new Error("admin keys failed"));
    await act(async () => { await expect(hook!.reload()).rejects.toThrow("admin keys failed"); });
    view.unmount();
  });

  it("disables the admin API-key query when no userId is given", async () => {
    let hook: ReturnType<typeof useAdminApiKeys>;
    const view = render(<HookHarnessWithClient client={createTestQueryClient()}><HookProbe hook={() => useAdminApiKeys("")} expose={(v) => { hook = v; }} /></HookHarnessWithClient>);
    expect(hook!.apiKeys).toEqual([]);
    expect(apiKeyApi.adminListUserApiKeys).not.toHaveBeenCalled();
    view.unmount();
  });

  it("covers the audit-log read hook and both purge mutations", async () => {
    let auditHook: ReturnType<typeof useAuditLog>;
    let purgeHook: ReturnType<typeof useSecurityPurges>;
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const view = render(<HookHarnessWithClient client={client}><HookProbe hook={() => useAuditLog({}, false)} expose={(v) => { auditHook = v; }} /><HookProbe hook={() => useSecurityPurges()} expose={(v) => { purgeHook = v; }} /></HookHarnessWithClient>);
    await act(async () => { await auditHook!.reload(); });
    await waitFor(() => expect(auditHook!.rows).toHaveLength(1));
    expect(auditHook!.count).toBe(1);
    await act(async () => { await purgeHook!.purgeAudit("1m"); });
    expect(securityApi.purgeAuditLog).toHaveBeenCalledWith({ window: "1m" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.auditLog() });
    await act(async () => { await purgeHook!.purgeKeys("1y"); });
    expect(securityApi.purgeApiKeys).toHaveBeenCalledWith({ window: "1y" });
    securityApi.getAuditLog.mockRejectedValueOnce(new Error("audit log failed"));
    await act(async () => { await expect(auditHook!.reload()).rejects.toThrow("audit log failed"); });
    view.unmount();
  });

  it("covers Google login hook", async () => {
    let hook: ReturnType<typeof useGoogleLogin>;
    const view = render(<HookProbe hook={() => useGoogleLogin("https://app.test/callback")} expose={(v) => { hook = v; }} />);
    await act(async () => { await hook!.start(); });
    expect(oauthApi.savePkceVerifier).toHaveBeenCalledWith("verifier");
    expect(window.location.assign).toHaveBeenCalledWith("https://accounts.test");
    oauthApi.createPkcePair.mockRejectedValueOnce(new Error("oauth failed"));
    await act(async () => { await expect(hook!.start()).rejects.toThrow("oauth failed"); });
    view.unmount();
  });
});

describe("default UI", () => {
  it("renders login success, Google, signup link, and error states", async () => {
    const view = render(<AuthProvider bootstrap={false}><LoginView signupHref="/signup" googleEnabled onGoogle={vi.fn()} /></AuthProvider>);
    expect(view.container.querySelector(".fa-auth-panel")).not.toBeNull();
    const [email, password] = Array.from(view.container.querySelectorAll("input"));
    act(() => {
      email.value = "ada@example.com";
      email.dispatchEvent(new Event("input", { bubbles: true }));
      password.value = "password";
      password.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(window.location.assign).toHaveBeenCalledWith("../user/account");
    authApi.login.mockRejectedValueOnce(new Error("bad login"));
    await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(view.container.textContent).toContain("bad login");
    view.unmount();
  });

  it("rejects invalid form input, surfaces field errors, and never calls login", async () => {
    const view = render(<AuthProvider bootstrap={false}><LoginForm /></AuthProvider>);
    await act(async () => {
      view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(authApi.login).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll("p.text-sm.text-destructive").length).toBeGreaterThan(0);
    view.unmount();
  });

  it("treats a strict-schema violation with no field target as blocking submission", async () => {
    const view = render(<AuthProvider bootstrap={false}><LoginForm /></AuthProvider>);
    const form = view.container.querySelector("form")!;
    const [email, password] = Array.from(view.container.querySelectorAll("input"));
    act(() => {
      email.value = "ada@example.com";
      email.dispatchEvent(new Event("input", { bubbles: true }));
      password.value = "password";
      password.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const extra = document.createElement("input");
    extra.name = "unexpected";
    extra.value = "x";
    form.appendChild(extra);
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(authApi.login).not.toHaveBeenCalled();
    view.unmount();
  });

  it("normalizes non-Error and empty-message submit failures to the default error message", async () => {
    const view = render(<AuthProvider bootstrap={false}><LoginForm /></AuthProvider>);
    const fillAndSubmit = async () => {
      const [email, password] = Array.from(view.container.querySelectorAll("input"));
      act(() => {
        email.value = "ada@example.com";
        email.dispatchEvent(new Event("input", { bubbles: true }));
        password.value = "password";
        password.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    };
    authApi.login.mockRejectedValueOnce("boom");
    await fillAndSubmit();
    expect(view.container.textContent).toContain("Invalid credentials. Please try again.");
    authApi.login.mockRejectedValueOnce(new Error(""));
    await fillAndSubmit();
    expect(view.container.textContent).toContain("Invalid credentials. Please try again.");
    view.unmount();
  });

  it("renders a provided Google icon and normalizes a non-Error Google login failure", async () => {
    const onGoogleFailure = vi.fn().mockRejectedValueOnce("google boom");
    const view = render(
      <AuthProvider bootstrap={false}>
        <LoginForm googleEnabled googleIcon={<svg data-testid="icon" />} onGoogleLogin={onGoogleFailure} />
      </AuthProvider>
    );
    expect(view.container.querySelector("svg")).not.toBeNull();
    await act(async () => {
      view.container.querySelector("button[type='button']")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(view.container.textContent).toContain("Google sign-in is not available.");
    view.unmount();
  });

  it("covers Google login unavailability, success, and failure branches", async () => {
    const unavailable = render(<AuthProvider bootstrap={false}><LoginView googleEnabled /></AuthProvider>);
    await act(async () => {
      unavailable.container.querySelector("button[type='button']")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(unavailable.container.textContent).toContain("Google sign-in is not available.");
    unavailable.unmount();

    const onGoogleSuccess = vi.fn().mockResolvedValueOnce(undefined);
    const success = render(<AuthProvider bootstrap={false}><LoginView googleEnabled onGoogle={onGoogleSuccess} /></AuthProvider>);
    await act(async () => {
      success.container.querySelector("button[type='button']")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onGoogleSuccess).toHaveBeenCalled();
    expect(success.container.textContent).not.toContain("Google sign-in is not available.");
    success.unmount();

    const onGoogleFailure = vi.fn().mockRejectedValueOnce(new Error("google failed"));
    const failure = render(<AuthProvider bootstrap={false}><LoginView googleEnabled onGoogle={onGoogleFailure} /></AuthProvider>);
    await act(async () => {
      failure.container.querySelector("button[type='button']")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(failure.container.textContent).toContain("google failed");
    failure.unmount();
  });

  it("omits the signup link when LoginView has no signupHref", () => {
    const view = render(<AuthProvider bootstrap={false}><LoginView /></AuthProvider>);
    expect(view.container.querySelector("a")).toBeNull();
    view.unmount();
  });

  it("renders account states, logout, and the signed-out placeholder", async () => {
    let view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await waitFor(() => expect(view.container.textContent).toContain("ada@example.com"));
    expect(view.container.querySelector(".fa-auth-panel dl")).not.toBeNull();
    await act(async () => { view.container.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    view.unmount();
    profileApi.getProfile.mockRejectedValueOnce(new Error("profile failed"));
    view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await waitFor(() => expect(view.container.textContent).toContain("Unable to load account"));
    expect(view.container.querySelector(".fa-auth-panel [role='alert']")).not.toBeNull();
    view.unmount();
    profileApi.getProfile.mockResolvedValueOnce(null as never);
    view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await waitFor(() => expect(view.container.textContent).toContain("Please sign in to view your account."));
    view.unmount();
    profileApi.getProfile.mockResolvedValueOnce({ ...user, full_name: null });
    view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await waitFor(() => expect(view.container.textContent).toContain("Not set"));
    view.unmount();
  });

  it("renders the starter account and login pages", async () => {
    const accountPage = render(<StarterAccountPage />);
    await waitFor(() => expect(accountPage.container.textContent).toContain("ada@example.com"));
    accountPage.unmount();

    const loginPage = render(<StarterLoginPage />);
    expect(loginPage.container.textContent).toContain("Sign in");
    loginPage.unmount();
  });

  it("renders callback success, missing state, and failure states", async () => {
    let view = render(<CallbackView />);
    expect(view.container.querySelector(".fa-auth-panel [role='status']")?.textContent).toContain("Completing sign in");
    await flush();
    expect(window.location.assign).toHaveBeenCalledWith("../user/account");
    view.unmount();
    oauthApi.takePkceVerifier.mockReturnValueOnce(null);
    view = render(<CallbackView />);
    await flush();
    expect(view.container.textContent).toContain("missing required state");
    expect(view.container.querySelector(".fa-auth-panel [role='alert']")).not.toBeNull();
    view.unmount();
    oauthApi.exchangeGoogleCode.mockRejectedValueOnce(new Error("exchange failed"));
    view = render(<CallbackView />);
    await flush();
    expect(view.container.textContent).toContain("Unable to complete OAuth sign in");
    expect(view.container.querySelector(".fa-auth-panel [role='alert']")).not.toBeNull();
    view.unmount();
  });

  it("renders signup placeholder", () => {
    const view = render(<SignupView />);
    expect(view.container.textContent).toContain("Signup unavailable");
    expect(view.container.querySelector(".fa-auth-panel")).not.toBeNull();
    view.unmount();
  });
});
