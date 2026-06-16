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
  "pages/login.astro": `---\nimport { AuthProvider } from "@fa-m8/astro-auth-m8/react";\nimport { LoginView } from "../components/LoginView";\nimport "../styles/auth.css";\n---\n<AuthProvider client:load>\n  <LoginView />\n</AuthProvider>\n`,
  "pages/account.astro": `---\nimport { AuthProvider } from "@fa-m8/astro-auth-m8/react";\nimport { AccountView } from "../components/AccountView";\nimport "../styles/auth.css";\n---\n<AuthProvider client:load>\n  <AccountView />\n</AuthProvider>\n`,
  "pages/logout.astro": `---\nimport "../styles/auth.css";\n---\n<form class="fa-auth-panel">\n  <h1>Sign out</h1>\n  <button type="button" id="fa-auth-logout">Sign out</button>\n</form>\n<script>\n  import { logout } from "@fa-m8/astro-auth-m8/client";\n  document.getElementById("fa-auth-logout")?.addEventListener("click", async () => {\n    await logout();\n    window.location.assign("/auth/login");\n  });\n</script>\n`,
  "pages/callback.astro": `---\nimport { CallbackView } from "../components/CallbackView";\nimport "../styles/auth.css";\n---\n<CallbackView client:load />\n`,
  "pages/signup.astro": `---\nimport { SignupView } from "../components/SignupView";\nimport "../styles/auth.css";\n---\n<SignupView client:load />\n`,
  "components/LoginView.tsx": `export { LoginView } from "@fa-m8/astro-auth-m8/default-ui";\n`,
  "components/AccountView.tsx": `export { AccountView } from "@fa-m8/astro-auth-m8/default-ui";\n`,
  "components/SignupView.tsx": `export { SignupView } from "@fa-m8/astro-auth-m8/default-ui";\n`,
  "components/CallbackView.tsx": `export { CallbackView } from "@fa-m8/astro-auth-m8/default-ui";\n`,
  "components/ApiKeysView.tsx": `import { useApiKeys } from "@fa-m8/astro-auth-m8/hooks";\n\nexport function ApiKeysView() {\n  const { apiKeys, loading } = useApiKeys();\n  if (loading) return <p>Loading API keys</p>;\n  return <ul>{apiKeys.map((key) => <li key={key.id}>{key.name}</li>)}</ul>;\n}\n`,
  "components/AdminUsersView.tsx": `import { useUsers } from "@fa-m8/astro-auth-m8/hooks";\n\nexport function AdminUsersView() {\n  const { users, loading } = useUsers();\n  if (loading) return <p>Loading users</p>;\n  return <ul>{users?.data.map((user) => <li key={user.id}>{user.email}</li>)}</ul>;\n}\n`,
  "i18n/en.ts": `export const authCopy = { signIn: "Sign in", account: "Account" };\n`,
  "i18n/es.ts": `export const authCopy = { signIn: "Iniciar sesion", account: "Cuenta" };\n`,
  "i18n/fr.ts": `export const authCopy = { signIn: "Connexion", account: "Compte" };\n`,
  "styles/auth.css": `.fa-auth-panel { width: min(100% - 32px, 420px); margin: 64px auto; font-family: system-ui, sans-serif; }\n.fa-auth-panel form, .fa-auth-panel label { display: grid; gap: 12px; }\n.fa-auth-panel input, .fa-auth-panel button { min-height: 40px; font: inherit; }\n`
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
