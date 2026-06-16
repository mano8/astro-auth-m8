import { describe, expect, it, vi } from "vitest";
import faAuth, { buildAuthRoutes } from "../src/integration.js";

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
});
