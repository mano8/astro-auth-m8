# astro-auth-m8

Astro integration and headless runtime client for `fa-auth-m8`.

Part of the M8 auth stack: [mano8/astro-auth-m8](https://github.com/mano8/astro-auth-m8) is the Astro plugin layer for the [mano8/fa-auth-m8](https://github.com/mano8/fa-auth-m8) backend service, and it is ready to compose into [mano8/fa-ui-m8](https://github.com/mano8/fa-ui-m8).

## Install

```bash
npm install @mano8/astro-auth-m8
```

Use it with a `fa-auth-m8` backend that satisfies the `fa-auth-m8@1.0` contract.

## Backend contract

This package targets the `fa-auth-m8@1.0` API contract and was tested against `fa-auth-m8` service version `1.0.0`. Supported backend service versions are `>=1.0.0 <1.1.0`.

Compatibility helpers are exported from `@mano8/astro-auth-m8/compatibility`. `fa-auth-m8` (>= 1.0.0) exposes a public `GET {API_PREFIX}/meta` route returning a `ServiceMeta` payload — pass it straight to the assert:

```ts
import { assertFaAuthM8Compatibility } from "@mano8/astro-auth-m8/compatibility";

const meta = await fetch(`${base}/user/meta`).then((r) => r.json());
// meta = { service, version, api_version, contract: { name, version, range } }
assertFaAuthM8Compatibility(meta); // reads nested contract.version + version
```

The helper also accepts flat fields (`auth_contract_version` / `contract_version` / `service_version`) for backends that surface metadata elsewhere.

## Modes

- `headless`: exports typed schemas, API wrappers, token handling, React provider/hooks, and route helpers without injecting pages.
- `starter`: injects small default login, logout, callback, and account routes with `injectRoute()`.
- `scaffold`: copies editable Astro/React/CSS files into a consumer app with `astro-auth-m8 scaffold --views --target src/auth`.

```ts
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faAuth from "@mano8/astro-auth-m8";

export default defineConfig({
  integrations: [
    react(),
    faAuth({
      apiBase: "/user",
      mode: "starter",
      routes: { base: "/[locale]" }
    })
  ]
});
```

The runtime keeps access tokens in memory only, sends refresh requests with `credentials: "include"`, and models public backend responses without secret session fields.

## shadcn views (registry)

For shadcn/Tailwind apps, this package ships a **shadcn registry** of ready-to-run
styled views. The headless logic stays a live dependency (`@mano8/astro-auth-m8/react`
+ `/hooks`); only the **skin** is copied into the consumer, so views adopt the app's
own tokens and are fully editable. The registry items are pre-built into the package at
`registry/r/*.json` (regenerate with `npm run build:registry`; the output is byte-for-byte
identical to `shadcn build`).

### Hosting model — local file registry

Install `@mano8/astro-auth-m8` from npm first, then consume the registry as a **local file** out of `node_modules` (no external host or token). Because shadcn resolves namespaced registries (`@name/item`) over HTTP, local consumption uses the **direct `.json` path** form of `shadcn add`. Optionally declare the namespace in `components.json` for documentation / future HTTP hosting:

```jsonc
// components.json
"registries": {
  "@fa-m8-auth": "./node_modules/@mano8/astro-auth-m8/registry/r/{name}.json"
}
```

### Items

| Item | `shadcn add` (run from the consumer project root) | registryDependencies | npm dependencies | Needs `@mano8/astro-auth-m8`? |
| :-- | :-- | :-- | :-- | :-- |
| `data-table` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/data-table.json` | `table`, `button`, `input` | `@tanstack/react-table` | no |
| `activity-bar-chart` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/activity-bar-chart.json` | `chart` | `recharts` | no |
| `dashboard-overview` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/dashboard-overview.json` | `card`, `skeleton`, `activity-bar-chart` | — | **yes** (`useDashboard`) |
| `account-dashboard` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/account-dashboard.json` | `button`, `skeleton`, `tabs`, `dashboard-overview` | — | **yes** (`AuthProvider`, `useAuth`) |
| `profile-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/profile-panel.json` | `card`, `button`, `input`, `label` | — | **yes** (`useAuth`, `useProfile`) |
| `sessions-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/sessions-panel.json` | `card`, `button` | `lucide-react` | **yes** (`useAuth`, `useSessions`, `useDashboard`) |
| `api-keys-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/api-keys-panel.json` | `card`, `button`, `input`, `label` | — | **yes** (`useApiKeys`) |
| `admin-users-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/admin-users-panel.json` | `card`, `button`, `input`, `label` | `lucide-react` | **yes** (`RequireRole`, `useUsers`) |

`dashboard-overview` is the landing view; `profile-panel`, `sessions-panel`,
`api-keys-panel`, and `admin-users-panel` are the secondary account tabs (drop them into
`account-dashboard`'s `extraTabs`, or into your own shell). Each reads its headless logic
straight from the package hooks — no local adapter layer — and takes its strings via
`labels`. `admin-users-panel` self-gates with `RequireRole superuser`.

Files land under `src/components/fa-auth/` (the items' `target`), import shadcn
primitives via `@/components/ui/*`, and pull headless logic from the installed package.
The plugin package is intentionally **not** listed in registry item `dependencies`; install
the published `@mano8/astro-auth-m8` package from npm yourself so shadcn only copies
the skin files.

### Consumer expectations

- shadcn configured with `style: radix-nova`, `baseColor: neutral`, `cssVariables: true`,
  lucide icons, and Tailwind v4 tokens in `src/styles/global.css`.
- The published `@mano8/astro-auth-m8` npm package installed and an `AuthProvider` in the tree (the dashboard hooks
  read the package's configured client).
- All view labels are props with English defaults — pass your own i18n strings to localize.

