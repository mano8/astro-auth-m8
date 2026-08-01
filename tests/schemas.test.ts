import { describe, expect, it } from "vitest";
import { ApiKeyAdminPublicSchema, ApiKeyCreatedSchema, ApiKeyCreateSchema, ApiKeyPublicSchema, ApiKeysAdminPublicSchema, ClientSessionPublicSchema, PrivilegedActionAuditPublicSchema, PrivilegedActionAuditsPublicSchema, PurgeRequestSchema, PurgeResponseSchema, RetentionWindowSchema, UserAuthorizationUpdateSchema, UserCreateSchema, UserUpdateMeSchema, UserUpdateSchema } from "../src/runtime/schemas.js";

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

  it("accepts is_active on update to make account activation reachable, rejects a non-boolean value", () => {
    expect(UserUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ is_active: true }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ is_active: null }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ is_active: "false" }).success).toBe(false);
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

  it("parses the fa-auth-m8@2.0.0 admin API-key listing (AA-17), a distinct shape from ApiKeyPublic", () => {
    const adminFixture = {
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      name: "ci-deploy",
      user_id: "5b9f083a-b23b-4823-9aa2-0d01875c4217",
      revoked: false,
      expires_at: null,
      last_used_at: null,
      created_at: "2026-06-15T00:00:00Z",
      access_mode: "read_write",
      status: "active",
      audiences: ["media-service-m8"]
    };

    expect(ApiKeyAdminPublicSchema.safeParse(adminFixture).success).toBe(true);
    expect(ApiKeyAdminPublicSchema.safeParse({ ...adminFixture, status: "unknown" }).success).toBe(false);
    // Distinct from ApiKeyPublicSchema: no `updated_at`, but does carry `user_id` + `status`.
    expect(ApiKeyPublicSchema.safeParse(adminFixture).success).toBe(false);

    const listFixture = { data: [adminFixture], count: 1 };
    expect(ApiKeysAdminPublicSchema.safeParse(listFixture).success).toBe(true);
  });

  it("models the closed retention-window enum and purge request/response contract (AA-19)", () => {
    for (const window of ["1w", "1m", "3m", "6m", "1y"]) {
      expect(RetentionWindowSchema.safeParse(window).success).toBe(true);
    }
    expect(RetentionWindowSchema.safeParse("1d").success).toBe(false);
    expect(RetentionWindowSchema.safeParse("2026-01-01").success).toBe(false);

    expect(PurgeRequestSchema.safeParse({ window: "3m" }).success).toBe(true);
    expect(PurgeRequestSchema.safeParse({ window: "3m", extra: true }).success).toBe(false);

    expect(PurgeResponseSchema.safeParse({ window: "1y", removed: 42 }).success).toBe(true);
    expect(PurgeResponseSchema.safeParse({ window: "1y", removed: -1 }).success).toBe(false);
  });

  it("parses the privileged-action audit-log listing", () => {
    const auditFixture = {
      id: "4a9f083a-b23b-4823-9aa2-0d01875c4216",
      created_at: "2026-06-15T00:00:00Z",
      actor_user_id: "5b9f083a-b23b-4823-9aa2-0d01875c4217",
      actor_role: "superadmin",
      action: "delete",
      table_name: "m8_api_key",
      row_pk: "4a9f083a-b23b-4823-9aa2-0d01875c4218",
      target_owner_id: "6c9f083a-b23b-4823-9aa2-0d01875c4219"
    };

    expect(PrivilegedActionAuditPublicSchema.safeParse(auditFixture).success).toBe(true);
    expect(PrivilegedActionAuditPublicSchema.safeParse({ ...auditFixture, target_owner_id: null }).success).toBe(true);
    const { target_owner_id: _omit, ...withoutOwner } = auditFixture;
    expect(PrivilegedActionAuditPublicSchema.safeParse(withoutOwner).success).toBe(true);
    expect(PrivilegedActionAuditPublicSchema.safeParse({ ...auditFixture, action: "read" }).success).toBe(false);

    expect(PrivilegedActionAuditsPublicSchema.safeParse({ data: [auditFixture], count: 1 }).success).toBe(true);
  });
});
