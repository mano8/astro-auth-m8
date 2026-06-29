import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import faAuth, { buildAuthRoutes } from "../src/integration.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const authRouteNames = ["account", "callback", "login", "logout", "signup"] as const;

describe("Astro integration", () => {
  it("is headless by default and wires config", () => {
    const integration = faAuth({ apiBase: "/api" });
    const injectRoute = vi.fn();
    const addMiddleware = vi.fn();
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute, addMiddleware, updateConfig } as never);
    expect(integration.name).toBe("@fa-m8/astro-auth-m8");
    expect(injectRoute).not.toHaveBeenCalled();
    expect(addMiddleware).not.toHaveBeenCalled();
    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({ vite: expect.any(Object) }));
  });

  it("injects starter routes and optional middleware", () => {
    const integration = faAuth({ mode: "starter", routes: { base: "/[locale]", signup: "/auth/signup" }, guards: { middleware: true } });
    const injectRoute = vi.fn();
    const addMiddleware = vi.fn();
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute, addMiddleware, updateConfig } as never);
    expect(injectRoute).toHaveBeenCalledTimes(5);
    expect(injectRoute).toHaveBeenCalledWith({ pattern: "/[locale]/auth/login", entrypoint: "@fa-m8/astro-auth-m8/routes/login.astro" });
    expect(addMiddleware).toHaveBeenCalledWith({ order: "pre", entrypoint: "@fa-m8/astro-auth-m8/middleware" });
  });

  it("skips disabled starter routes", () => {
    const integration = faAuth({ mode: "starter" });
    const injectRoute = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute, addMiddleware: vi.fn(), updateConfig: vi.fn() } as never);
    expect(injectRoute).toHaveBeenCalledTimes(4);
  });

  it("does not inject package views when strategy is none", () => {
    const integration = faAuth({ mode: "starter", views: { strategy: "none" } });
    const injectRoute = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute, addMiddleware: vi.fn(), updateConfig: vi.fn() } as never);
    expect(injectRoute).not.toHaveBeenCalled();
  });

  it("re-exports route builders", () => {
    expect(buildAuthRoutes({ base: "/[locale]" }).account).toBe("/[locale]/user/account");
  });

  it("injects an empty CSP policy when middleware is not active (headless default)", () => {
    const integration = faAuth({ apiBase: "/user" });
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute: vi.fn(), addMiddleware: vi.fn(), updateConfig } as never);
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_AUTH_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("injects a non-empty CSP policy when middleware is active", () => {
    const integration = faAuth({ guards: { middleware: true } });
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute: vi.fn(), addMiddleware: vi.fn(), updateConfig } as never);
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_AUTH_CSP_POLICY"] as string) as string;
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self'");
  });

  it("includes auth origin in CSP connect-src when apiBase is an external URL", () => {
    const integration = faAuth({ apiBase: "https://auth.example.com/user", guards: { middleware: true } });
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute: vi.fn(), addMiddleware: vi.fn(), updateConfig } as never);
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_AUTH_CSP_POLICY"] as string) as string;
    expect(policy).toContain("https://auth.example.com");
  });

  it("injects an empty CSP policy when csp.enabled is false even if middleware is active", () => {
    const integration = faAuth({ guards: { middleware: true }, csp: { enabled: false } });
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute: vi.fn(), addMiddleware: vi.fn(), updateConfig } as never);
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_AUTH_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("includes connectExtraOrigins in the CSP connect-src", () => {
    const integration = faAuth({ guards: { middleware: true }, csp: { connectExtraOrigins: ["https://media.example.com"] } });
    const updateConfig = vi.fn();
    integration.hooks["astro:config:setup"]?.({ injectRoute: vi.fn(), addMiddleware: vi.fn(), updateConfig } as never);
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_AUTH_CSP_POLICY"] as string) as string;
    expect(policy).toContain("https://media.example.com");
  });

  it("inlines starter route styles so client page changes keep formatting", () => {
    for (const routeName of authRouteNames) {
      const source = readFileSync(resolve(testDir, `../src/routes/${routeName}.astro`), "utf8");
      expect(source).toContain('import AuthStyles from "./_AuthStyles.astro"');
      expect(source).toContain("<AuthStyles />");
      expect(source).not.toContain('import "../scaffold/styles/auth.css"');
    }
  });
});
