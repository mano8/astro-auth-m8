#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const command = args[0];

function readFlag(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

function write(target: string, content: string, force: boolean): void {
  if (existsSync(target) && !force) {
    throw new Error(`${target} already exists. Re-run with --force to overwrite it.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

const files: Record<string, string> = {
  "pages/login.astro": `---\nimport { AuthProvider } from "@mano8/astro-auth-m8/react";\nimport { LoginView } from "../components/LoginView";\nimport "../styles/auth.css";\n---\n<AuthProvider client:load>\n  <LoginView />\n</AuthProvider>\n`,
  "pages/account.astro": `---\nimport { AuthProvider } from "@mano8/astro-auth-m8/react";\nimport { AccountView } from "../components/AccountView";\nimport "../styles/auth.css";\n---\n<AuthProvider client:load>\n  <AccountView />\n</AuthProvider>\n`,
  "pages/logout.astro": `---\nimport "../styles/auth.css";\n---\n<form class="fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">\n  <div class="space-y-2">\n    <h1 class="text-3xl font-semibold tracking-tight text-foreground">Sign out</h1>\n    <p class="text-sm text-muted-foreground">End the current session and return to the login screen.</p>\n  </div>\n  <button type="button" id="fa-auth-logout" class="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">Sign out</button>\n</form>\n<script>\n  import { logout } from "@mano8/astro-auth-m8/client";\n  document.getElementById("fa-auth-logout")?.addEventListener("click", async () => {\n    await logout();\n    window.location.assign("/auth/login");\n  });\n</script>\n`,
  "pages/callback.astro": `---\nimport { CallbackView } from "../components/CallbackView";\nimport "../styles/auth.css";\n---\n<CallbackView client:load />\n`,
  "pages/signup.astro": `---\nimport { SignupView } from "../components/SignupView";\nimport "../styles/auth.css";\n---\n<SignupView client:load />\n`,
  "components/LoginView.tsx": `export { LoginView } from "@mano8/astro-auth-m8/default-ui";\n`,
  "components/AccountView.tsx": `export { AccountView } from "@mano8/astro-auth-m8/default-ui";\n`,
  "components/SignupView.tsx": `export { SignupView } from "@mano8/astro-auth-m8/default-ui";\n`,
  "components/CallbackView.tsx": `export { CallbackView } from "@mano8/astro-auth-m8/default-ui";\n`,
  "components/ApiKeysView.tsx": `import { useApiKeys } from "@mano8/astro-auth-m8/hooks";\n\nexport function ApiKeysView() {\n  const { apiKeys, loading } = useApiKeys();\n  if (loading) return <p>Loading API keys</p>;\n  return <ul>{apiKeys.map((key) => <li key={key.id}>{key.name}</li>)}</ul>;\n}\n`,
  "components/AdminUsersView.tsx": `import { useUsers } from "@mano8/astro-auth-m8/hooks";\n\nexport function AdminUsersView() {\n  const { users, loading } = useUsers();\n  if (loading) return <p>Loading users</p>;\n  return <ul>{users?.data.map((user) => <li key={user.id}>{user.email}</li>)}</ul>;\n}\n`,
  "i18n/en.ts": `export const authCopy = { signIn: "Sign in", account: "Account" };\n`,
  "i18n/es.ts": `export const authCopy = { signIn: "Iniciar sesion", account: "Cuenta" };\n`,
  "i18n/fr.ts": `export const authCopy = { signIn: "Connexion", account: "Compte" };\n`,
  "styles/auth.css": `@import "@mano8/astro-ui-m8/src/lib/tokens.css";\n\n.fa-auth-panel select { color-scheme: light; }\n:root[data-theme='dark'] .fa-auth-panel select { color-scheme: dark; }\n.fa-auth-panel select option { background-color: var(--popover, Canvas); color: var(--popover-foreground, CanvasText); }\n`
};

if (command !== "scaffold" || !hasFlag("--views")) {
  console.error("Usage: astro-auth-m8 scaffold --views --target src/auth [--force]");
  process.exit(1);
}

const target = readFlag("--target", "src/auth")!;
const force = hasFlag("--force");

try {
  for (const [name, content] of Object.entries(files)) {
    write(join(process.cwd(), target, name), content, force);
  }
  console.log(`Scaffolded auth views into ${target}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
