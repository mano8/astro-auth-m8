import { request } from "../client.js";
import { GoogleExchangeResponseSchema, GoogleLoginUrlResponseSchema, type GoogleExchangeResponse, type GoogleLoginUrlResponse } from "../schemas.js";

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

export function exchangeGoogleCode(body: { code: string; code_verifier: string; client_hint?: string }): Promise<GoogleExchangeResponse> {
  return request({
    method: "POST",
    path: "/google-api/exchange/",
    body,
    schema: GoogleExchangeResponseSchema,
    skipRefresh: true
  });
}
