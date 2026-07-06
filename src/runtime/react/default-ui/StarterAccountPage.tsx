import { AuthProvider } from "../AuthProvider.js";
import type { AuthRuntimeConfig } from "../../config.js";
import { AccountView } from "./AccountView.js";

export function StarterAccountPage({ config }: { config?: Partial<AuthRuntimeConfig> }) {
  return (
    <AuthProvider config={config}>
      <AccountView />
    </AuthProvider>
  );
}
