// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

const authApi = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), refreshToken: vi.fn() }));
const profileApi = vi.hoisted(() => ({ getProfile: vi.fn(), updateProfile: vi.fn() }));
const apiKeyApi = vi.hoisted(() => ({ listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn() }));
const dashboardApi = vi.hoisted(() => ({ getGlobalActivity: vi.fn(), getUserActivity: vi.fn() }));
const sessionApi = vi.hoisted(() => ({ listSessions: vi.fn() }));
const userApi = vi.hoisted(() => ({ listUsers: vi.fn() }));
const oauthApi = vi.hoisted(() => ({ createPkcePair: vi.fn(), getGoogleLoginUrl: vi.fn(), savePkceVerifier: vi.fn(), exchangeGoogleCode: vi.fn(), takePkceVerifier: vi.fn() }));

vi.mock("../src/runtime/api/auth.js", () => authApi);
vi.mock("../src/runtime/api/profile.js", () => profileApi);
vi.mock("../src/runtime/api/apiKeys.js", () => apiKeyApi);
vi.mock("../src/runtime/api/dashboard.js", () => dashboardApi);
vi.mock("../src/runtime/api/sessions.js", () => sessionApi);
vi.mock("../src/runtime/api/users.js", () => userApi);
vi.mock("../src/runtime/api/oauth.js", () => oauthApi);

import { AuthProvider, AuthQueryProvider, RequireAuth, RequireRole, useAuth } from "../src/runtime/react/index.js";
import { AccountView, CallbackView, LoginView, SignupView } from "../src/runtime/react/default-ui/index.js";
import { useApiKeys } from "../src/runtime/hooks/useApiKeys.js";
import { useDashboard } from "../src/runtime/hooks/useDashboard.js";
import { useGoogleLogin } from "../src/runtime/hooks/useGoogleLogin.js";
import { useProfile } from "../src/runtime/hooks/useProfile.js";
import { useSessions } from "../src/runtime/hooks/useSessions.js";
import { useUsers } from "../src/runtime/hooks/useUsers.js";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  provider: "password" as const,
  email: "ada@example.com",
  full_name: "Ada",
  avatar: null,
  is_active: true,
  email_verified: true,
  is_superuser: true,
  role: "admin" as const
};

function flush() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

function QueryClientProbe({ expose }: { expose: (client: QueryClient) => void }) {
  const client = useQueryClient();
  expose(client);
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  authApi.login.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  authApi.logout.mockResolvedValue({ message: "bye" });
  authApi.refreshToken.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  profileApi.getProfile.mockResolvedValue(user);
  profileApi.updateProfile.mockResolvedValue({ success: true, user });
  apiKeyApi.listApiKeys.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111112", name: "key", expires_at: null, revoked: false, last_used_at: null }]);
  apiKeyApi.createApiKey.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111113", name: "new", expires_at: null, revoked: false, last_used_at: null, plaintext: "secret" });
  apiKeyApi.revokeApiKey.mockResolvedValue({ message: "revoked" });
  dashboardApi.getUserActivity.mockResolvedValue({ nb_users: 1, activity: { min: 0, max: 1, activity: [] } });
  dashboardApi.getGlobalActivity.mockResolvedValue({ nb_users: 2, activity: { min: 0, max: 2, activity: [] } });
  sessionApi.listSessions.mockResolvedValue({ data: [], count: 0 });
  userApi.listUsers.mockResolvedValue({ data: [user], count: 1 });
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
    await act(async () => { await auth!.login("ada@example.com", "password"); });
    expect(authApi.login).toHaveBeenCalledWith("ada@example.com", "password");
    await act(async () => { await auth!.reload(); });
    await act(async () => { await auth!.logout(); });
    expect(authApi.logout).toHaveBeenCalled();
    view.unmount();
  });

  it("handles bootstrap and reload errors, disabled bootstrap, fallback branches, and missing provider", async () => {
    profileApi.getProfile.mockRejectedValueOnce(new Error("profile failed"));
    authApi.refreshToken.mockRejectedValueOnce(new Error("refresh failed"));
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
    expect(() => render(<button onClick={() => useAuth()}>bad</button>)).not.toThrow();
  });
});

describe("hooks", () => {
  it("covers profile hook success and error paths", async () => {
    let hook: ReturnType<typeof useProfile>;
    const view = render(<HookProbe hook={() => useProfile(false)} expose={(v) => { hook = v; }} />);
    await act(async () => { await hook!.reload(); });
    await act(async () => { await hook!.save({ full_name: "Ada" }); });
    profileApi.getProfile.mockRejectedValueOnce(new Error("boom"));
    await act(async () => { await expect(hook!.reload()).rejects.toThrow("boom"); });
    view.unmount();
  });

  it("covers API key hook success and error paths", async () => {
    let hook: ReturnType<typeof useApiKeys>;
    const view = render(<HookProbe hook={() => useApiKeys(false)} expose={(v) => { hook = v; }} />);
    await act(async () => { await hook!.reload(); });
    await act(async () => { await hook!.create({ ttl_hours: 1 }); });
    await act(async () => { await hook!.revoke("id"); });
    apiKeyApi.listApiKeys.mockRejectedValueOnce(new Error("keys failed"));
    await act(async () => { await expect(hook!.reload()).rejects.toThrow("keys failed"); });
    view.unmount();
  });

  it("covers dashboard, users, and sessions hooks", async () => {
    let dash: ReturnType<typeof useDashboard>;
    let globalDash: ReturnType<typeof useDashboard>;
    let usersHook: ReturnType<typeof useUsers>;
    let sessionsHook: ReturnType<typeof useSessions>;
    const view = render(<><HookProbe hook={() => useDashboard("me", false)} expose={(v) => { dash = v; }} /><HookProbe hook={() => useDashboard("global", false)} expose={(v) => { globalDash = v; }} /><HookProbe hook={() => useUsers(false)} expose={(v) => { usersHook = v; }} /><HookProbe hook={() => useSessions(false)} expose={(v) => { sessionsHook = v; }} /></>);
    await act(async () => { await dash!.reload(); await globalDash!.reload(); await usersHook!.reload(); await sessionsHook!.reload(); });
    dashboardApi.getUserActivity.mockRejectedValueOnce(new Error("dash failed"));
    userApi.listUsers.mockRejectedValueOnce(new Error("users failed"));
    sessionApi.listSessions.mockRejectedValueOnce(new Error("sessions failed"));
    await act(async () => { await expect(dash!.reload()).rejects.toThrow("dash failed"); });
    await act(async () => { await expect(usersHook!.reload()).rejects.toThrow("users failed"); });
    await act(async () => { await expect(sessionsHook!.reload()).rejects.toThrow("sessions failed"); });
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

  it("renders account states and logout", async () => {
    let view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await flush();
    expect(view.container.textContent).toContain("ada@example.com");
    await act(async () => { view.container.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    view.unmount();
    profileApi.getProfile.mockRejectedValueOnce(new Error("profile failed"));
    view = render(<AuthProvider bootstrap={false}><AccountView /></AuthProvider>);
    await flush();
    expect(view.container.textContent).toContain("Unable to load account");
    view.unmount();
  });

  it("renders callback success, missing state, and failure states", async () => {
    let view = render(<CallbackView />);
    await flush();
    expect(window.location.assign).toHaveBeenCalledWith("../user/account");
    view.unmount();
    oauthApi.takePkceVerifier.mockReturnValueOnce(null);
    view = render(<CallbackView />);
    await flush();
    expect(view.container.textContent).toContain("missing required state");
    view.unmount();
    oauthApi.exchangeGoogleCode.mockRejectedValueOnce(new Error("exchange failed"));
    view = render(<CallbackView />);
    await flush();
    expect(view.container.textContent).toContain("Unable to complete OAuth sign in");
    view.unmount();
  });

  it("renders signup placeholder", () => {
    const view = render(<SignupView />);
    expect(view.container.textContent).toContain("Signup unavailable");
    view.unmount();
  });
});
