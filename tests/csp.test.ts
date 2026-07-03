import { describe, expect, it } from "vitest";
import { buildAuthConnectSrc, buildAuthCspPolicy, originOf } from "../src/lib/csp.js";

describe("originOf", () => {
  it("extracts the origin from an absolute URL", () => {
    expect(originOf("https://auth.example.com/user")).toBe("https://auth.example.com");
    expect(originOf("https://auth.example.com:8443/user/v1/")).toBe("https://auth.example.com:8443");
  });

  it("returns null for a relative path", () => {
    expect(originOf("/user")).toBeNull();
    expect(originOf("user")).toBeNull();
    expect(originOf("")).toBeNull();
  });
});

describe("buildAuthConnectSrc", () => {
  it("returns self-only for a relative apiBase", () => {
    expect(buildAuthConnectSrc("/user")).toBe("'self'");
  });

  it("adds the auth service origin when apiBase is an absolute URL", () => {
    expect(buildAuthConnectSrc("https://auth.example.com/user")).toBe("'self' https://auth.example.com");
  });

  it("includes extra absolute origins", () => {
    const src = buildAuthConnectSrc("/user", ["https://media.example.com"]);
    expect(src).toBe("'self' https://media.example.com");
  });

  it("deduplicates when an extra origin matches the apiBase origin", () => {
    const src = buildAuthConnectSrc("https://auth.example.com/user", ["https://auth.example.com"]);
    expect(src).toBe("'self' https://auth.example.com");
  });

  it("ignores extra entries that are relative paths (resolve to null)", () => {
    expect(buildAuthConnectSrc("/user", ["/media", "relative"])).toBe("'self'");
  });

  it("handles multiple unique extra origins", () => {
    const src = buildAuthConnectSrc("/user", ["https://cdn.example.com", "https://media.example.com"]);
    expect(src).toContain("'self'");
    expect(src).toContain("https://cdn.example.com");
    expect(src).toContain("https://media.example.com");
  });
});

describe("buildAuthCspPolicy", () => {
  it("includes all required directives", () => {
    const policy = buildAuthCspPolicy("/user");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).toContain("connect-src 'self'");
  });

  it("restricts script-src to self without unsafe-inline", () => {
    const policy = buildAuthCspPolicy("/user");
    const scriptSrc = policy.split("; ").find(d => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self'");
  });

  it("allows style unsafe-inline for React inline styles", () => {
    const policy = buildAuthCspPolicy("/user");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("sets connect-src to self-only for a relative apiBase", () => {
    const policy = buildAuthCspPolicy("/user");
    const connectSrc = policy.split("; ").find(d => d.startsWith("connect-src"));
    expect(connectSrc).toBe("connect-src 'self'");
  });

  it("adds auth origin to connect-src for an external apiBase", () => {
    const policy = buildAuthCspPolicy("https://auth.example.com/user");
    expect(policy).toContain("connect-src 'self' https://auth.example.com");
  });

  it("forwards connectExtraOrigins into connect-src", () => {
    const policy = buildAuthCspPolicy("/user", { connectExtraOrigins: ["https://cdn.example.com"] });
    expect(policy).toContain("https://cdn.example.com");
  });

  it("formats directives separated by semicolons with no trailing separator", () => {
    const policy = buildAuthCspPolicy("/user");
    const parts = policy.split("; ");
    expect(parts.length).toBeGreaterThan(5);
    expect(policy).not.toMatch(/; $/);
    for (const part of parts) {
      expect(part).toMatch(/^[a-z-]+ .+/);
    }
  });
});
