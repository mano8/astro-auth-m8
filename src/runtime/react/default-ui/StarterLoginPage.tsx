import { AuthProvider } from "../AuthProvider.js";
import type { AuthRuntimeConfig } from "../../config.js";
import { LoginView } from "./LoginView.js";

export function StarterLoginPage({ config }: { config?: Partial<AuthRuntimeConfig> }) {
  return (
    <AuthProvider config={config}>
      <LoginView />
    </AuthProvider>
  );
}
