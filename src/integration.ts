import type { AstroIntegration } from "astro";
import { buildAuthRoutes, type AuthRouteFragments } from "./runtime/routes.js";

export type FaAuthAstroOptions = {
  apiBase?: string;
  mode?: "headless" | "starter";
  output?: "static" | "server" | "hybrid";
  locales?: string[];
  defaultLocale?: string;
  routes?: AuthRouteFragments;
  google?: {
    enabled?: boolean;
    redirect?: string | ((locale: string) => string);
  };
  auth?: {
    tokenMode?: "memory-access-cookie-refresh";
    refreshPath?: string;
    logoutPath?: string;
    csrfHeader?: string;
  };
  views?: {
    strategy?: "none" | "package" | "scaffolded";
    layout?: "plain" | "starlight" | "custom";
    customLayoutImport?: string;
    componentsImport?: string;
    i18nImport?: string;
  };
  guards?: {
    middleware?: boolean;
    protectedRoutes?: string[];
    adminRoutes?: string[];
  };
};

const ROUTE_ENTRYPOINTS = {
  login: "@fa-m8/astro-auth-m8/routes/login.astro",
  signup: "@fa-m8/astro-auth-m8/routes/signup.astro",
  logout: "@fa-m8/astro-auth-m8/routes/logout.astro",
  callback: "@fa-m8/astro-auth-m8/routes/callback.astro",
  account: "@fa-m8/astro-auth-m8/routes/account.astro"
} as const;

export default function faAuth(options: FaAuthAstroOptions = {}): AstroIntegration {
  const mode = options.mode ?? "headless";
  const routes = buildAuthRoutes(options.routes);

  return {
    name: "@fa-m8/astro-auth-m8",
    hooks: {
      "astro:config:setup": ({ injectRoute, addMiddleware, updateConfig }) => {
        updateConfig({
          vite: {
            define: {
              "import.meta.env.PUBLIC_FA_AUTH_API_BASE": JSON.stringify(options.apiBase ?? "/user"),
              "import.meta.env.PUBLIC_FA_AUTH_REFRESH_PATH": JSON.stringify(options.auth?.refreshPath ?? "/login/refresh-token/"),
              "import.meta.env.PUBLIC_FA_AUTH_LOGOUT_PATH": JSON.stringify(options.auth?.logoutPath ?? "/login/logout/")
            }
          }
        });

        if (mode === "starter" && (options.views?.strategy ?? "package") !== "none") {
          for (const [name, pattern] of Object.entries(routes)) {
            if (!pattern) continue;
            injectRoute({
              pattern,
              entrypoint: ROUTE_ENTRYPOINTS[name as keyof typeof ROUTE_ENTRYPOINTS]
            });
          }
        }

        if (options.guards?.middleware) {
          addMiddleware({
            order: "pre",
            entrypoint: "@fa-m8/astro-auth-m8/middleware"
          });
        }
      }
    }
  };
}

export { buildAuthRoutes } from "./runtime/routes.js";
export type { AuthRouteFragments, BuiltAuthRoutes } from "./runtime/routes.js";
