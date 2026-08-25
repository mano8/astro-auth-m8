import type { ReactNode } from "react";
import { AuthProvider } from "../AuthProvider.js";
import { AuthErrorBoundary } from "../AuthErrorBoundary.js";
import type { AuthRuntimeConfig } from "../../config.js";

/**
 * Island root for `logout.astro` (`A-C3`).
 *
 * The route used to mount `AuthProvider` itself, which left the one island with
 * no boundary above it — and a boundary *inside* `AuthProvider` would not help,
 * because `configureAuth` runs in that component's own body. Wrapping there is
 * the whole point, so the route mounts this instead.
 *
 * It is deliberately a pass-through for children: the sign-out form is authored
 * as markup in the `.astro` route and arrives here as slot content, so this
 * component adds the boundary and the provider without claiming ownership of
 * the page's copy.
 */
export function StarterLogoutPage({
  children,
  config
}: {
  children?: ReactNode;
  config?: Partial<AuthRuntimeConfig>;
}) {
  return (
    <AuthErrorBoundary>
      <AuthProvider config={config}>{children}</AuthProvider>
    </AuthErrorBoundary>
  );
}
