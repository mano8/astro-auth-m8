import { AuthProvider } from "../AuthProvider.js";
import { AuthErrorBoundary } from "../AuthErrorBoundary.js";
import type { AuthRuntimeConfig } from "../../config.js";
import { LoginView } from "./LoginView.js";

// The boundary is the outermost wrapper on purpose (`A-C3`). `AuthProvider`
// calls `configureAuth` in its own body, so a boundary mounted inside it would
// be unmounted by exactly the throw most likely to happen here.
export function StarterLoginPage({ config }: { config?: Partial<AuthRuntimeConfig> }) {
  return (
    <AuthErrorBoundary>
      <AuthProvider config={config}>
        <LoginView />
      </AuthProvider>
    </AuthErrorBoundary>
  );
}
