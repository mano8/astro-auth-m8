export type AuthCspOptions = {
  connectExtraOrigins?: string[];
};

/** Extracts the origin (scheme + host + port) from an absolute URL; returns null for relative paths. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Builds the `connect-src` directive value for the auth service and any extra origins.
 * Relative `apiBase` values (e.g. `/user`) add nothing beyond `'self'`.
 */
export function buildAuthConnectSrc(apiBase: string, extraOrigins: string[] = []): string {
  const origins = new Set(["'self'"]);
  const authOrigin = originOf(apiBase);
  if (authOrigin) origins.add(authOrigin);
  for (const o of extraOrigins) {
    const origin = originOf(o);
    if (origin) origins.add(origin);
  }
  return [...origins].join(" ");
}

/**
 * Builds a Content-Security-Policy header value for auth integration routes.
 *
 * Scripts are strict (`'self'` only, no `'unsafe-inline'`).
 * Styles allow `'unsafe-inline'` because React/Radix set inline styles that cannot be hashed.
 * The `connect-src` directive includes the auth API origin when `apiBase` is an absolute URL.
 */
export function buildAuthCspPolicy(apiBase: string, options: AuthCspOptions = {}): string {
  const connectSrc = buildAuthConnectSrc(apiBase, options.connectExtraOrigins ?? []);
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'"],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data: blob: https:"],
    ["font-src", "'self' data:"],
    ["connect-src", connectSrc],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
  ];
  return directives.map(([k, v]) => `${k} ${v}`).join("; ");
}
