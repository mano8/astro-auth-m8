import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/client.js", () => ({
  request: requestMock
}));

vi.mock("../src/runtime/tokenStore.js", () => ({
  clearToken: vi.fn(),
  setToken: vi.fn()
}));

import * as apiKeys from "../src/runtime/api/apiKeys.js";
import * as auth from "../src/runtime/api/auth.js";
import * as dashboard from "../src/runtime/api/dashboard.js";
import * as oauth from "../src/runtime/api/oauth.js";
import * as ops from "../src/runtime/api/ops.js";
import * as profile from "../src/runtime/api/profile.js";
import * as security from "../src/runtime/api/security.js";
import * as sessions from "../src/runtime/api/sessions.js";
import * as users from "../src/runtime/api/users.js";
import { clearToken, setToken } from "../src/runtime/tokenStore.js";

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({ access_token: "t", token_type: "bearer", message: "ok" });
  vi.mocked(clearToken).mockClear();
  vi.mocked(setToken).mockClear();
});

describe("auth API", () => {
  it("logs in, refreshes, logs out, and tests tokens", async () => {
    await auth.login("a@example.com", "pw");
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST", path: "/login/access-token", form: { username: "a@example.com", password: "pw" }, skipRefresh: true }));
    expect(setToken).toHaveBeenCalledWith("t");
    await auth.refreshToken();
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/login/refresh-token/", skipRefresh: true }));
    await auth.logout();
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/login/logout/", auth: true, skipRefresh: true }));
    expect(clearToken).toHaveBeenCalled();
    await auth.testToken();
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/login/test-token/", auth: true }));
  });

  it("reuses the in-flight refresh request", async () => {
    let resolveRefresh: ((value: { access_token: string; token_type: string }) => void) | undefined;
    requestMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const first = auth.refreshToken();
    const second = auth.refreshToken();

    expect(requestMock).toHaveBeenCalledTimes(1);
    resolveRefresh?.({ access_token: "shared", token_type: "bearer" });

    await expect(first).resolves.toMatchObject({ access_token: "shared" });
    await expect(second).resolves.toMatchObject({ access_token: "shared" });
    expect(setToken).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenCalledWith("shared");
  });
});

describe("feature API wrappers", () => {
  it("covers profile endpoints", async () => {
    await profile.getProfile();
    await profile.updateProfile({ full_name: "Ada" });
    await profile.updatePassword({ current_password: "password1", new_password: "password2" });
    await profile.deleteProfile();
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/profile/get/me/", "/profile/update/me/", "/profile/me/password/", "/profile/delete/me/"]);
  });

  it("covers API key endpoints", async () => {
    await apiKeys.listApiKeys();
    await apiKeys.createApiKey({ ttl_hours: 24 });
    await apiKeys.getApiKey("key id");
    await apiKeys.revokeApiKey("key id");
    await apiKeys.verifyApiKey("secret");
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/profile/api-keys/", "/profile/api-keys/", "/profile/api-keys/key%20id", "/profile/api-keys/key%20id", "/profile/api-keys/verify"]);
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ headers: { "X-API-Key": "secret" }, skipRefresh: true }));
  });

  it("covers the admin API-key surface", async () => {
    await apiKeys.adminListUserApiKeys("user id");
    await apiKeys.adminRevokeApiKey("key id");
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/api-keys/by-user/user%20id/", "/api-keys/revoke/key%20id/"]);
    expect(requestMock.mock.calls.map(([arg]) => arg.method)).toEqual(["GET", "POST"]);
    expect(requestMock.mock.calls.every(([arg]) => arg.auth === true)).toBe(true);
  });

  it("covers the security audit-log and purge surface", async () => {
    await security.getAuditLog();
    await security.getAuditLog({ skip: 5, limit: 10 });
    await security.purgeAuditLog({ window: "1m" });
    await security.purgeApiKeys({ window: "1y" });
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/security/audit-log", "/security/audit-log", "/security/audit-log/purge", "/security/api-keys/purge"]);
    expect(requestMock.mock.calls[0][0].query).toEqual({ skip: 0, limit: 100 });
    expect(requestMock.mock.calls[1][0].query).toEqual({ skip: 5, limit: 10 });
    expect(requestMock.mock.calls[2][0].body).toEqual({ window: "1m" });
    expect(requestMock.mock.calls[3][0].body).toEqual({ window: "1y" });
  });

  it("covers user endpoints", async () => {
    await users.listUsers(1, 2);
    await users.createUser({ provider: "password", email: "a@example.com", password: "password1" });
    await users.signupUser({ email: "a@example.com", password: "password1" });
    await users.getUser("u id");
    await users.updateUser("u id", { full_name: "Ada" });
    await users.deleteUser("u id");
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/users/", "/users/new_user/", "/users/signup/", "/users/get/u%20id/", "/users/update/u%20id/", "/users/delete/u%20id/"]);
  });

  it("covers session endpoints", async () => {
    await sessions.getCurrentSession();
    await sessions.updateCurrentExternalSession({ external_access_token: "a" });
    await sessions.listSessions(1, 2);
    await sessions.getSession("s id");
    await sessions.getSessionByUser("u id");
    await sessions.revokeSession("s id");
    await sessions.revokeSessionsByUser("u id");
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/sessions/get-current/", "/sessions/refresh-google-tokens/", "/sessions/", "/sessions/get/s%20id/", "/sessions/get-by-user/u%20id/", "/sessions/delete/s%20id/", "/sessions/delete-by-user/u%20id/"]);
  });

  it("covers dashboard and ops endpoints", async () => {
    await dashboard.getUserActivity();
    await dashboard.getGlobalActivity();
    await ops.getAuthHealth();
    await ops.getJwks();
    await ops.getServiceMeta();
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/dashboard/users/activity/current/", "/dashboard/users/activity/", "/health/", "/.well-known/jwks.json", "/meta"]);
    expect(requestMock).toHaveBeenLastCalledWith(expect.objectContaining({ method: "GET", path: "/meta", skipRefresh: true }));
    expect(requestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty("auth");
  });
});

describe("oauth helpers", () => {
  it("stores and consumes the PKCE verifier", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => store.delete(k)
    });
    oauth.savePkceVerifier("verifier");
    expect(oauth.takePkceVerifier()).toBe("verifier");
    expect(oauth.takePkceVerifier()).toBeNull();
    vi.unstubAllGlobals();
  });

  it("creates a PKCE pair and calls Google endpoints", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(2).buffer) }
    });
    vi.stubGlobal("btoa", (value: string) => Buffer.from(value, "binary").toString("base64"));
    const pair = await oauth.createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    await oauth.getGoogleLoginUrl({ redirect_target: "https://app.test/callback", code_challenge: pair.challenge });
    await oauth.exchangeGoogleCode({ code: "code", code_verifier: pair.verifier, client_hint: "web" });
    expect(requestMock.mock.calls.map(([arg]) => arg.path)).toEqual(["/google-api/login-url/", "/google-api/exchange/"]);
    vi.unstubAllGlobals();
  });
});
