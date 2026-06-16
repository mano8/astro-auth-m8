import { describe, expect, it } from "vitest";
import { authRedirect, buildAuthRoutes, routeForLocale } from "../src/runtime/routes.js";

describe("route builders", () => {
  it("builds non-localized defaults", () => {
    expect(buildAuthRoutes()).toEqual({
      login: "/auth/login",
      signup: undefined,
      logout: "/auth/logout",
      callback: "/auth/callback",
      account: "/user/account"
    });
  });

  it("builds localized routes", () => {
    const routes = buildAuthRoutes({ base: "/[locale]", signup: "/auth/signup" });
    expect(routes.login).toBe("/[locale]/auth/login");
    expect(routeForLocale(routes.login!, "es")).toBe("/es/auth/login");
  });
});


it("covers disabled routes, root joins, and redirect fallbacks", () => {
  const disabled = buildAuthRoutes({ base: "/", login: false, logout: false, callback: false, account: false });
  expect(disabled).toEqual({ login: undefined, signup: undefined, logout: undefined, callback: undefined, account: undefined });
  expect(buildAuthRoutes({ login: "/" }).login).toBe("/");
  expect(buildAuthRoutes({ base: undefined, login: "/auth/login" }).login).toBe("/auth/login");
  expect(routeForLocale("/:locale/auth/login")).toBe("/auth/login");
  expect(authRedirect(disabled, "login")).toBe("/");
  expect(authRedirect({ login: "/[locale]/auth/login" }, "login", "fr")).toBe("/fr/auth/login");
});
