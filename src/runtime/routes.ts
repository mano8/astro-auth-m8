export type AuthRouteFragments = {
  base?: string;
  login?: string | false;
  signup?: string | false;
  logout?: string | false;
  callback?: string | false;
  account?: string | false;
};

export type BuiltAuthRoutes = {
  login?: string;
  signup?: string;
  logout?: string;
  callback?: string;
  account?: string;
};

const DEFAULT_FRAGMENTS: Required<Omit<AuthRouteFragments, "base">> & { base: string } = {
  base: "",
  login: "/auth/login",
  signup: false,
  logout: "/auth/logout",
  callback: "/auth/callback",
  account: "/user/account"
};

function joinRoute(base: string, fragment: string): string {
  const value = `/${[base, fragment].join("/")}`.replace(/\/+/g, "/");
  return value === "/" ? "/" : value.replace(/\/$/, "");
}

export function buildAuthRoutes(routes: AuthRouteFragments = {}): BuiltAuthRoutes {
  const merged = { ...DEFAULT_FRAGMENTS, ...routes };
  const base = merged.base ?? "";
  return {
    login: merged.login === false ? undefined : joinRoute(base, merged.login),
    signup: merged.signup === false ? undefined : joinRoute(base, merged.signup),
    logout: merged.logout === false ? undefined : joinRoute(base, merged.logout),
    callback: merged.callback === false ? undefined : joinRoute(base, merged.callback),
    account: merged.account === false ? undefined : joinRoute(base, merged.account)
  };
}

export function routeForLocale(pattern: string, locale?: string): string {
  return locale ? pattern.replace("[locale]", locale) : pattern.replace("/:locale", "").replace("[locale]", "");
}

export function authRedirect(routes: BuiltAuthRoutes, page: keyof BuiltAuthRoutes, locale?: string): string {
  const route = routes[page];
  if (!route) return "/";
  return routeForLocale(route, locale);
}
