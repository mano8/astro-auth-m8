export type AuthRuntimeConfig = {
  apiBase: string;
  refreshPath: string;
  logoutPath: string;
  csrfHeader: string;
};

const DEFAULT_CONFIG: AuthRuntimeConfig = {
  apiBase: "/user",
  refreshPath: "/login/refresh-token/",
  logoutPath: "/login/logout/",
  csrfHeader: "X-Requested-With"
};

let runtimeConfig: AuthRuntimeConfig = { ...DEFAULT_CONFIG };

export function configureAuth(config: Partial<AuthRuntimeConfig> = {}): AuthRuntimeConfig {
  runtimeConfig = { ...runtimeConfig, ...config };
  return runtimeConfig;
}

export function getAuthConfig(): AuthRuntimeConfig {
  return runtimeConfig;
}

export function resetAuthConfig(): void {
  runtimeConfig = { ...DEFAULT_CONFIG };
}
