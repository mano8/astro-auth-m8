import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configureAuth, getAuthConfig, resetAuthConfig } from "../src/runtime/config.js";
import { ApiError, messageFromDetail, normalizeFastApiError, UnauthenticatedError } from "../src/runtime/errors.js";
import { clearToken, getToken, runRefresh, setToken } from "../src/runtime/tokenStore.js";
import { authUrl, request } from "../src/runtime/client.js";
import { MessageSchema, TokenSchema } from "../src/runtime/schemas.js";
import { onRequest } from "../src/middleware.js";

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const sourceFile = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

describe("runtime config", () => {
  afterEach(() => resetAuthConfig());

  it("configures and resets auth runtime options", () => {
    expect(getAuthConfig().apiBase).toBe("/user");
    configureAuth({ apiBase: "/api", csrfHeader: "X-CSRF" });
    expect(getAuthConfig()).toMatchObject({ apiBase: "/api", csrfHeader: "X-CSRF" });
    resetAuthConfig();
    expect(getAuthConfig().apiBase).toBe("/user");
  });
});

describe("errors", () => {
  it("normalizes FastAPI detail payloads and preserves other payloads", () => {
    expect(normalizeFastApiError({ detail: "bad" })).toBe("bad");
    expect(normalizeFastApiError({ message: "bad" })).toEqual({ message: "bad" });
    expect(new ApiError(409, "conflict")).toMatchObject({ name: "ApiError", status: 409, detail: "conflict" });
    expect(new UnauthenticatedError()).toMatchObject({ name: "UnauthenticatedError", status: 401 });
  });

  it("derives readable messages from error detail", () => {
    expect(messageFromDetail("Incorrect password")).toBe("Incorrect password");
    expect(messageFromDetail("  ")).toBeUndefined();
    expect(messageFromDetail([{ msg: "field required" }, { msg: "too short" }])).toBe("field required; too short");
    expect(messageFromDetail([{ loc: ["body"] }, { msg: "" }, null])).toBeUndefined();
    expect(messageFromDetail({ unexpected: true })).toBeUndefined();
  });

  it("surfaces the backend detail as the ApiError message when no override is given", () => {
    expect(new ApiError(400, "Incorrect password").message).toBe("Incorrect password");
    expect(new ApiError(422, [{ msg: "field required" }]).message).toBe("field required");
    expect(new ApiError(500, { weird: true }).message).toBe("Auth API request failed");
    expect(new ApiError(409, "conflict", "Custom override").message).toBe("Custom override");
  });
});

describe("token store", () => {
  afterEach(() => clearToken());

  it("stores tokens and runs refresh as single flight", async () => {
    setToken("a");
    expect(getToken()).toBe("a");
    const refresh = vi.fn(async () => "b");
    const [one, two] = await Promise.all([runRefresh(refresh), runRefresh(refresh)]);
    expect(one).toBe("b");
    expect(two).toBe("b");
    expect(refresh).toHaveBeenCalledTimes(1);
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("keeps React Query files out of token persistence and refresh mechanics", () => {
    const reactQueryFiles = [
      "src/runtime/react/AuthQueryProvider.tsx",
      "src/runtime/hooks/useApiKeys.ts",
      "src/runtime/hooks/useDashboard.ts",
      "src/runtime/hooks/useProfile.ts",
      "src/runtime/hooks/useSessions.ts",
      "src/runtime/hooks/useUsers.ts"
    ];
    const forbiddenBoundaryTerms = [
      "tokenStore",
      "getToken",
      "setToken",
      "clearToken",
      "runRefresh",
      "refreshToken",
      "localStorage",
      "sessionStorage"
    ];

    for (const file of reactQueryFiles) {
      const source = sourceFile(file);
      expect(source).toContain("@tanstack/react-query");
      for (const term of forbiddenBoundaryTerms) {
        expect(source, `${file} must not own ${term}`).not.toContain(term);
      }
    }
  });
});

describe("client", () => {
  beforeEach(() => {
    resetAuthConfig();
    clearToken();
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds auth URLs and rejects unsupported protocols", () => {
    configureAuth({ apiBase: "/user" });
    expect(authUrl("/profile/get/me/")).toBe("https://app.test/user/profile/get/me/");
    vi.unstubAllGlobals();
    expect(authUrl("/profile/get/me/")).toBe("http://localhost/user/profile/get/me/");
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    configureAuth({ apiBase: "ftp://example.test" });
    expect(() => authUrl("/x")).toThrow("Unsupported auth API protocol");
  });

  it("sends JSON, auth headers, query params, and parses success", async () => {
    setToken("token-1");
    const fetchMock = vi.fn(async () => jsonResponse({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await request({ method: "POST", path: "/thing", query: { a: 1, b: false, c: null }, body: { x: true }, auth: true, schema: MessageSchema });
    expect(result.message).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("a=1");
    expect(String(url)).toContain("b=false");
    expect(String(url)).not.toContain("c=");
    expect((init as RequestInit).credentials).toBe("include");
    expect((init as RequestInit).body).toBe(JSON.stringify({ x: true }));
    expect(new Headers((init as RequestInit).headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("sends form bodies", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: "abc", token_type: "bearer" }));
    vi.stubGlobal("fetch", fetchMock);
    await request({ method: "POST", path: "/login", form: { username: "a", password: "b" }, schema: TokenSchema });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe("username=a&password=b");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/x-www-form-urlencoded");
  });

  it("refreshes once after 401 and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "new-token", token_type: "bearer" }))
      .mockResolvedValueOnce(jsonResponse({ message: "retried" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await request({ method: "GET", path: "/needs-auth", auth: true, schema: MessageSchema });
    expect(result.message).toBe("retried");
    expect(getToken()).toBe("new-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws unauthenticated when refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(new Response("", { status: 401 })));
    await expect(request({ method: "GET", path: "/nope", schema: MessageSchema })).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws normalized API errors, text errors, direct 401s, and handles 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    await expect(request({ method: "GET", path: "/unauth", skipRefresh: true, schema: MessageSchema })).rejects.toBeInstanceOf(UnauthenticatedError);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "bad" }, { status: 400 })));
    await expect(request({ method: "GET", path: "/bad", skipRefresh: true, schema: MessageSchema })).rejects.toMatchObject({ status: 400, detail: "bad" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("plain", { status: 500 })));
    await expect(request({ method: "GET", path: "/bad", skipRefresh: true, schema: MessageSchema })).rejects.toMatchObject({ detail: "plain" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(request({ method: "DELETE", path: "/gone", schema: MessageSchema })).resolves.toBeUndefined();
  });
});

describe("middleware", () => {
  it("passes through unchanged when no CSP policy is set", async () => {
    const response = new Response("ok");
    expect(await Promise.resolve(onRequest({}, () => response))).toBe(response);
  });

  it("injects CSP header into a sync response when policy is set", () => {
    vi.stubEnv("PUBLIC_FA_AUTH_CSP_POLICY", "default-src 'self'");
    const response = new Response("ok", { status: 200 });
    const result = onRequest({}, () => response) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
    expect(result.status).toBe(200);
    vi.unstubAllEnvs();
  });

  it("injects CSP header into an async response when policy is set", async () => {
    vi.stubEnv("PUBLIC_FA_AUTH_CSP_POLICY", "default-src 'self'");
    const response = new Response("ok");
    const result = await (onRequest({}, () => Promise.resolve(response)) as Promise<Response>);
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
    vi.unstubAllEnvs();
  });

  it("preserves an existing CSP header set by the caller", () => {
    vi.stubEnv("PUBLIC_FA_AUTH_CSP_POLICY", "default-src 'self'");
    const response = new Response("ok", { headers: { "Content-Security-Policy": "default-src 'none'" } });
    const result = onRequest({}, () => response) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    vi.unstubAllEnvs();
  });

  it("preserves response status and body when injecting CSP", () => {
    vi.stubEnv("PUBLIC_FA_AUTH_CSP_POLICY", "default-src 'self'");
    const response = new Response("hello", { status: 302, statusText: "Found" });
    const result = onRequest({}, () => response) as Response;
    expect(result.status).toBe(302);
    expect(result.statusText).toBe("Found");
    vi.unstubAllEnvs();
  });
});
