import { describe, expect, it } from "vitest";
import { ApiKeyCreatedSchema, ApiKeyCreateSchema, ApiKeyPublicSchema, ClientSessionPublicSchema, UserAuthorizationUpdateSchema, UserCreateSchema, UserUpdateMeSchema, UserUpdateSchema } from "../src/runtime/schemas.js";

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

  it("defaults API key ttl and access_mode to the backend defaults", () => {
    const parsed = ApiKeyCreateSchema.parse({});
    expect(parsed.ttl_hours).toBe(24);
    expect(parsed.access_mode).toBe("read_only");
  });

  it("accepts an explicit read_write access_mode and audiences on create, rejects an unknown mode", () => {
    expect(ApiKeyCreateSchema.safeParse({ access_mode: "read_write", audiences: ["media-service-m8"] }).success).toBe(true);
    expect(ApiKeyCreateSchema.safeParse({ access_mode: "admin" }).success).toBe(false);
  });

  it("parses fa-auth-m8@2.0.0 ApiKeyPublic/ApiKeyCreated fixtures with access_mode + audiences", () => {
    const publicFixture = {
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      name: "ci-deploy",
      expires_at: null,
      revoked: false,
      last_used_at: null,
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
      access_mode: "read_write",
      audiences: ["media-service-m8"]
    };

    expect(ApiKeyPublicSchema.safeParse(publicFixture).success).toBe(true);
    expect(ApiKeyCreatedSchema.safeParse({ ...publicFixture, plaintext: "secret" }).success).toBe(true);
    expect(ApiKeyPublicSchema.safeParse({ ...publicFixture, access_mode: "admin" }).success).toBe(false);
  });

  it("rejects is_superuser in create schema", () => {
    expect(UserCreateSchema.safeParse({ provider: "password", email: "a@example.com", password: "password123", is_superuser: true }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ provider: "password", email: "a@example.com", password: "password123", is_superuser: false }).success).toBe(false);
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

  it("parses the fa-auth-m8@2.0.0 role-change response (auth_generation + revocation_enqueued)", () => {
    const result = UserAuthorizationUpdateSchema.safeParse({
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      provider: "password",
      email: "a@example.com",
      full_name: null,
      avatar: null,
      is_active: true,
      email_verified: false,
      is_superuser: false,
      role: "admin",
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
      auth_generation: 3,
      revocation_enqueued: true
    });

    expect(result.success).toBe(true);
  });

  it("rejects a role-change response missing the 2.0.0 contract fields", () => {
    expect(UserAuthorizationUpdateSchema.safeParse({
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      provider: "password",
      email: "a@example.com",
      is_active: true,
      email_verified: false,
      is_superuser: false,
      role: "admin"
    }).success).toBe(false);
  });

  it("keeps self-service profile updates limited to backend-supported fields", () => {
    expect(UserUpdateMeSchema.safeParse({ email: "a@example.com", full_name: "Ada", avatar: "https://example.com/avatar.png" }).success).toBe(true);
    expect(UserUpdateMeSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(UserUpdateMeSchema.safeParse({ is_superuser: true }).success).toBe(false);
  });
});
