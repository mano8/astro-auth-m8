import { describe, expect, it } from "vitest";
import { authKeys } from "../src/runtime/queryKeys.js";

describe("authKeys", () => {
  it("builds stable root and singleton resource keys", () => {
    expect(authKeys.all()).toEqual(["auth"]);
    expect(authKeys.profile()).toEqual(["auth", "profile"]);
    expect(authKeys.sessions()).toEqual(["auth", "sessions"]);
    expect(authKeys.apiKeys()).toEqual(["auth", "apiKeys"]);
  });

  it("builds dashboard keys for each scope", () => {
    expect(authKeys.dashboard()).toEqual(["auth", "dashboard", "me"]);
    expect(authKeys.dashboard("global")).toEqual(["auth", "dashboard", "global"]);
  });

  it("builds stable list and detail keys", () => {
    const params = { page: 2, q: "ada", active: true };

    expect(authKeys.users()).toEqual(["auth", "users", {}]);
    expect(authKeys.users(params)).toEqual(["auth", "users", params]);
    expect(authKeys.users({ ...params })).toEqual(["auth", "users", params]);
    expect(authKeys.user("user-1")).toEqual(["auth", "users", "user-1"]);
  });

  it("builds admin API-key and audit-log keys", () => {
    expect(authKeys.adminApiKeys("user-1")).toEqual(["auth", "adminApiKeys", "user-1"]);
    const params = { skip: 0, limit: 100 };
    expect(authKeys.auditLog()).toEqual(["auth", "auditLog", {}]);
    expect(authKeys.auditLog(params)).toEqual(["auth", "auditLog", params]);
  });
});
