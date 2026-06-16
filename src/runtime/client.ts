import { z } from "zod";
import { getAuthConfig } from "./config.js";
import { ApiError, normalizeFastApiError, UnauthenticatedError } from "./errors.js";
import { getToken, runRefresh, setToken } from "./tokenStore.js";
import { TokenSchema } from "./schemas.js";

export * from "./api/index.js";
export { clearToken, getToken, setToken } from "./tokenStore.js";

export type RequestOptions<T> = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  form?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  schema: z.ZodType<T>;
  auth?: boolean;
  skipRefresh?: boolean;
};

export function authUrl(path: string): string {
  const { apiBase } = getAuthConfig();
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${apiBase}${path}`, origin);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported auth API protocol");
  }
  return url.toString();
}

async function refreshAccessToken(): Promise<string | null> {
  const config = getAuthConfig();
  const response = await fetch(authUrl(config.refreshPath), {
    method: "POST",
    credentials: "include",
    headers: {
      [config.csrfHeader]: "XMLHttpRequest"
    }
  });
  if (!response.ok) return null;
  const token = TokenSchema.parse(await response.json());
  return token.access_token;
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const config = getAuthConfig();
  const url = new URL(authUrl(options.path));
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value != null) url.searchParams.set(key, String(value));
  }

  const headers = new Headers({
    [config.csrfHeader]: "XMLHttpRequest",
    ...options.headers
  });
  if (options.auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const execute = () => fetch(url.toString(), {
    method: options.method,
    headers,
    body,
    credentials: "include"
  });

  let response = await execute();
  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await runRefresh(refreshAccessToken);
    if (refreshed) {
      setToken(refreshed);
      headers.set("Authorization", `Bearer ${refreshed}`);
      response = await execute();
    } else {
      setToken(null);
      throw new UnauthenticatedError("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      throw new UnauthenticatedError();
    }
    let detail: unknown;
    try {
      detail = normalizeFastApiError(await response.clone().json());
    } catch {
      detail = await response.text();
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return options.schema.parse(await response.json());
}
