import { refreshToken } from "./api/auth.js";
import { getServiceMeta } from "./api/ops.js";
import { getProfile } from "./api/profile.js";
import { getFaAuthM8Compatibility } from "./compatibility.js";
import { configureAuth, type AuthRuntimeConfig } from "./config.js";
import { getToken } from "./tokenStore.js";

export type FaAuthBrowserUser = {
  id: string;
  role: "superadmin" | "admin" | "writer" | "reader" | "user";
  is_superuser: boolean;
};

export type FaAuthBrowserAdapter = {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  getCurrentUser: () => Promise<FaAuthBrowserUser>;
};

type BrowserAuthGlobal = typeof globalThis & {
  __M8_FA_AUTH_ADAPTER__?: FaAuthBrowserAdapter;
};

let warnedUnknownCompatibility = false;

// AA-16/AA-22: warn-not-throw preflight against the released fa-auth-m8
// contract. Runs once per adapter install and never blocks or fails setup —
// a GET /meta failure (offline, CORS, an older backend without the route) is
// swallowed, since this is advisory only. `assertFaAuthM8Compatibility`
// remains exported, unchanged, for hosts that want to fail closed instead.
function runCompatibilityPreflight(): void {
  void getServiceMeta()
    .then((meta) => {
      const compatibility = getFaAuthM8Compatibility(meta);
      if (compatibility.status === "incompatible") {
        console.warn(`[@mano8/astro-auth-m8] ${compatibility.reason}`);
      } else if (compatibility.status === "unknown" && !warnedUnknownCompatibility) {
        warnedUnknownCompatibility = true;
        console.warn(`[@mano8/astro-auth-m8] ${compatibility.reason}`);
      }
    })
    .catch(() => {});
}

/**
 * Expose the auth-owned browser adapter for independently installed plugins.
 * Plugins consume this browser contract through their local auth adapters;
 * they never import auth runtime modules directly.
 */
export function installFaAuthBrowserAdapter(
  config: Partial<AuthRuntimeConfig> = {}
): FaAuthBrowserAdapter {
  configureAuth(config);
  runCompatibilityPreflight();

  const adapter: FaAuthBrowserAdapter = {
    getAccessToken: getToken,
    refresh: async () => (await refreshToken()).access_token,
    getCurrentUser: async () => {
      const user = await getProfile();
      return {
        id: user.id,
        role: user.role,
        is_superuser: user.is_superuser
      };
    }
  };

  (globalThis as BrowserAuthGlobal).__M8_FA_AUTH_ADAPTER__ = adapter;
  return adapter;
}
