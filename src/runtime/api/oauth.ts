import { request } from "../client.js";
import { GoogleExchangeResponseSchema, GoogleLoginUrlResponseSchema, type GoogleExchangeResponse, type GoogleLoginUrlResponse } from "../schemas.js";
import { markSessionPresent } from "../sessionHint.js";

const VERIFIER_KEY = "fa-auth-m8:pkce-verifier";

function base64Url(bytes: ArrayBuffer): string {
  const values = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(values).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function savePkceVerifier(verifier: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier);
}

export function takePkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  return verifier;
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes.buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(digest) };
}

export function getGoogleLoginUrl(params: { redirect_target: string; code_challenge: string }): Promise<GoogleLoginUrlResponse> {
  return request({
    method: "GET",
    path: "/google-api/login-url/",
    query: params,
    schema: GoogleLoginUrlResponseSchema,
    skipRefresh: true
  });
}

export async function exchangeGoogleCode(body: { code: string; code_verifier: string; client_hint?: string }): Promise<GoogleExchangeResponse> {
  const exchanged = await request({
    method: "POST",
    path: "/google-api/exchange/",
    body,
    schema: GoogleExchangeResponseSchema,
    skipRefresh: true
  });
  // A completed exchange establishes this browser's session. Recorded here
  // rather than in a callback view because a consumer may complete the flow
  // with its own UI on this wrapper (fa-ui-m8 does) and then hard-navigate,
  // never touching `AuthProvider.login`; without this, a hint left by an
  // earlier refused refresh would make the destination page skip its
  // bootstrap and render a freshly signed-in user as signed out.
  markSessionPresent();
  return exchanged;
}
