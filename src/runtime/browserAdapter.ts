import { refreshToken } from "./api/auth.js";
import { getProfile } from "./api/profile.js";
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

/**
 * Expose the auth-owned browser adapter for independently installed plugins.
 * Plugins consume this browser contract through their local auth adapters;
 * they never import auth runtime modules directly.
 */
export function installFaAuthBrowserAdapter(
  config: Partial<AuthRuntimeConfig> = {}
): FaAuthBrowserAdapter {
  configureAuth(config);

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
