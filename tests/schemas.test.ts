import { describe, expect, it } from "vitest";
import { ApiKeyCreateSchema, ClientSessionPublicSchema, UserCreateSchema, UserUpdateMeSchema, UserUpdateSchema } from "../src/runtime/schemas.js";

describe("contract schemas", () => {
  it("keeps secret session fields out of the public session schema", () => {
    const result = ClientSessionPublicSchema.safeParse({
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      provider: "password",
      jwt_jti: "jwt-id-value",
      jwt_expires_at: "2026-06-15T00:00:00Z",
      refresh_expires_at: "2026-06-16T00:00:00Z",
      revoked: false,
      external_token_expires_at: null,
      refresh_token_hash: "secret",
      external_access_token: "secret",
      external_refresh_token: "secret"
    });

    expect(result.success).toBe(false);
  });

  it("defaults API key ttl to the backend default", () => {
    expect(ApiKeyCreateSchema.parse({}).ttl_hours).toBe(24);
  });

  it("enforces password-provider create rules", () => {
    expect(UserCreateSchema.safeParse({ provider: "password", email: "a@example.com" }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ provider: "password", email: "a@example.com", password: "password123" }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ email: "a@example.com", password: "password123", oauth_user_id: "oauth" }).success).toBe(false);
  });

  it("enforces google-provider create rules", () => {
    expect(UserCreateSchema.safeParse({ provider: "google", email: "a@example.com", oauth_user_id: "google-1" }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ provider: "google", email: "a@example.com", password: "password123", oauth_user_id: "google-1" }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ provider: "google", email: "a@example.com" }).success).toBe(false);
  });

  it("enforces provider-specific update rules", () => {
    expect(UserUpdateSchema.safeParse({ provider: "password", oauth_user_id: "google-1" }).success).toBe(false);
    expect(UserUpdateSchema.safeParse({ provider: "google", password: "password123" }).success).toBe(false);
    expect(UserUpdateSchema.safeParse({ provider: "password", password: "password123", avatar: "https://example.com/avatar.png" }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ provider: "google", oauth_user_id: "google-1", role: "admin" }).success).toBe(true);
  });

  it("keeps self-service profile updates limited to backend-supported fields", () => {
    expect(UserUpdateMeSchema.safeParse({ email: "a@example.com", full_name: "Ada", avatar: "https://example.com/avatar.png" }).success).toBe(true);
    expect(UserUpdateMeSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(UserUpdateMeSchema.safeParse({ is_superuser: true }).success).toBe(false);
  });
});
