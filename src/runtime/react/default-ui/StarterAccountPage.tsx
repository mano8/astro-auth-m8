import { AuthProvider } from "../AuthProvider.js";
import { AuthErrorBoundary } from "../AuthErrorBoundary.js";
import type { AuthRuntimeConfig } from "../../config.js";
import { AccountView } from "./AccountView.js";

// The boundary is the outermost wrapper on purpose (`A-C3`); see
// StarterLoginPage for why it sits outside `AuthProvider`.
export function StarterAccountPage({ config }: { config?: Partial<AuthRuntimeConfig> }) {
  return (
    <AuthErrorBoundary>
      <AuthProvider config={config}>
        <AccountView />
      </AuthProvider>
    </AuthErrorBoundary>
  );
}
