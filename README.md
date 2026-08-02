# astro-auth-m8

![CI/CD](https://github.com/mano8/astro-auth-m8/actions/workflows/CI.yaml/badge.svg?branch=main)
[![codecov](https://codecov.io/github/mano8/astro-auth-m8/graph/badge.svg?token=ZHBQDSPASI)](https://codecov.io/github/mano8/astro-auth-m8)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/f9dcb2a93b074a6289454beae553050f)](https://app.codacy.com/gh/mano8/astro-auth-m8/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

Astro integration and headless runtime client for `fa-auth-m8`.

Part of the M8 auth stack: [mano8/astro-auth-m8](https://github.com/mano8/astro-auth-m8) is the Astro plugin layer for the [mano8/fa-auth-m8](https://github.com/mano8/fa-auth-m8) backend service, and it is ready to compose into [mano8/fa-ui-m8](https://github.com/mano8/fa-ui-m8).

## Install

```bash
npm install @mano8/astro-auth-m8
```

Use it with a `fa-auth-m8` backend that satisfies the `fa-auth-m8@2.0` contract.

## Backend contract

This package targets the `fa-auth-m8@2.0` API contract and was tested against `fa-auth-m8` service version `2.0.0`. Supported backend service versions are `>=2.0.0 <3.0.0`.

Compatibility helpers are exported from `@mano8/astro-auth-m8/compatibility`. `fa-auth-m8` (>= 1.0.0) exposes a public `GET {API_PREFIX}/meta` route returning a `ServiceMeta` payload - pass it straight to the assert:

```ts
import { assertFaAuthM8Compatibility } from "@mano8/astro-auth-m8/compatibility";

const meta = await fetch(`${base}/user/meta`).then((r) => r.json());
// meta = { service, version, api_version, contract: { name, version, range } }
assertFaAuthM8Compatibility(meta); // reads nested contract.version + version
```

The helper also accepts flat fields (`auth_contract_version` / `contract_version` / `service_version`) for backends that surface metadata elsewhere.

### Automatic preflight

`installFaAuthBrowserAdapter` (wired in by this package's Astro integration on every page) runs a `GET {API_PREFIX}/meta` preflight itself, once per install, and calls `getFaAuthM8Compatibility` (not the throwing assert) on the result. An incompatible contract or service version logs one `console.warn` naming the expected contract/range; an unrecognized (`"unknown"`) `/meta` payload warns at most once per page. Neither case throws or blocks adapter setup, and a `/meta` fetch failure (offline, CORS, a pre-1.0 backend without the route) is swallowed silently, since the preflight is advisory only. Hosts that want a hard version gate instead should still call `assertFaAuthM8Compatibility` themselves — it is exported unchanged and throws on `"incompatible"` (and on `"unknown"` unless `requireKnown` is passed `false`).

## Authorization predicates

`@mano8/astro-auth-m8/authorization` is the single place this package encodes the role hierarchy and the role/`is_superuser` cross-field invariant. It mirrors the backend's canonical `auth_sdk_m8.authorization` module, so client-side gating cannot drift from what the server enforces.

```ts
import { hasMinimumRole, hasSuperuserPrivileges } from "@mano8/astro-auth-m8/authorization";

// Ordered hierarchy - a higher role satisfies a lower requirement.
hasMinimumRole(user.role, "admin"); // true for "superadmin"

// Dual evidence - never decide from `role` alone or `is_superuser` alone.
hasSuperuserPrivileges(user.role, user.is_superuser);
```

The valid role/flag pairs are `superadmin` with `is_superuser: true`, and every other role with `is_superuser: false`. `privilegeClaimsAreConsistent` exposes that invariant on its own, and `ORDERED_ROLES` exposes the hierarchy, highest privilege first. Any other pair - including an unrecognised role - grants nothing. These are display predicates; the backend stays the authority.

## Error presentation

`@mano8/astro-auth-m8/errors` exports `ApiError` plus `describeApiError(error, fallback)`, which maps the `fa-auth-m8` 2.0.0 authorization/rate-limit/retention error contracts to an operator-readable `{ title, description? }` (used by the `errorMessage` helper in the account registry blocks):

```ts
import { describeApiError } from "@mano8/astro-auth-m8/errors";

const { title, description } = describeApiError(error, "Update failed");
```

`409` `last_superuser_required` is labelled (the raw token is never surfaced); `403` is titled by status (`Not permitted`) with the backend's own readable detail as the description, since several surfaces produce a `403` and the detail that distinguishes them is not a stable contract; `429` and `503` are distinguished (rate limited vs. an unknown outcome that must not be retried); `400` free-text detail (e.g. a purge's retention-floor rejection) is surfaced verbatim under a labelled heading rather than pattern-matched.

## Admin API-key and security surfaces (fa-auth-m8 2.0.0)

`@mano8/astro-auth-m8/api` and `@mano8/astro-auth-m8/hooks` wrap the five 2.0.0 admin routes:

```ts
import { adminListUserApiKeys, adminRevokeApiKey, getAuditLog, purgeApiKeys, purgeAuditLog } from "@mano8/astro-auth-m8/api";
import { useAdminApiKeys, useAuditLog, useSecurityPurges } from "@mano8/astro-auth-m8/hooks";
```

- `useAdminApiKeys(userId)` - superadmin-only list + revoke of another user's keys. Metadata only (`ApiKeyAdminPublic`, exported from `@mano8/astro-auth-m8/schemas`): adds `user_id` and a server-derived `status` (`active`/`revoked`/`expired`), omits `updated_at` - a distinct shape from the owner-facing `ApiKeyPublic`, never reused for it.
- `useAuditLog(params)` - the read-only privileged-action audit trail. Gate with `hasMinimumRole(role, "admin")`, not the superuser predicate: an admin sees only the rows it authored, a superadmin sees every row, and the split is decided server-side from the authenticated principal - the client never sends an actor id to widen or narrow it.
- `useSecurityPurges()` - both retention purges (`purgeAudit`, `purgeKeys`). The `window` is the closed enum `"1w" | "1m" | "3m" | "6m" | "1y"` (`RetentionWindowSchema`), never free text or a date. Gate with `hasSuperuserPrivileges`, a different predicate from the audit-log read. All three admin surfaces are rate limited: `429` means the action was not attempted (safe to retry later, never automatically); `503` means the outcome is *unknown* (do not retry); a purge's `400` is a free-text retention-floor rejection - see [Error presentation](#error-presentation) for how `describeApiError` maps all three.

`GET /security/superuser-probe` is deliberately not wrapped - it is the `security-tests-m8` harness canary, not a client surface. The four `/security/*` routes are excluded from the backend's OpenAPI schema (`include_in_schema=False`); their shapes here are recorded from the backend source and a live/tested response, not schema-generated.

The ready-made skin for both tiers is the `security-panel` registry item (see [Items](#items)); `AccountTab.minRole` on `account-dashboard` is how an admin-tier tab is declared in the account shell, alongside the existing superuser-only `superuserOnly`.

### Revocation signals

`PATCH /users/update/{id}/` answers with `revocation_enqueued`. When it is `true`, that user's sessions have already been revoked and an authorization-generation bump is propagating, so any client state describing its privileges is stale on arrival. `useUsers().update` therefore invalidates the affected auth caches (profile, sessions, API keys, that user's admin key list) and emits a revocation notification:

```ts
import { AUTH_REVOCATION_EVENT, emitAuthRevocation } from "@mano8/astro-auth-m8/react";

// Only needed if you bypass `useUsers` with your own mutation layer.
emitAuthRevocation(updated.id);
```

A mounted `AuthProvider` listens for it and, when the id is the signed-in principal's, re-reads the profile immediately rather than waiting for the next incidental `getProfile()`. It raises `loading` while doing so, so `RequireRole`/`RequireAuth` fall back instead of rendering privileged UI from superseded claims. Notifications for any other user id are ignored. The backend remains the authority; this only stops a stale client view outliving the change.

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

For shadcn/Tailwind apps, this package ships a **shadcn registry** of ready-to-run styled views. The headless logic stays a live dependency (`@mano8/astro-auth-m8/react` + `/hooks`); only the **skin** is copied into the consumer, so views adopt the app's own tokens and are fully editable. The registry items are pre-built into the package at `registry/r/*.json` (regenerate with `npm run build:registry`; the output is byte-for-byte identical to `shadcn build`).

Shared table and state primitives live in `@mano8/astro-ui-m8`. This package depends on it normally because auth registry items reference `astro-ui-m8` generated registry JSON from `node_modules`.

### Hosting model - local file registry

Install `@mano8/astro-auth-m8` from npm first, then consume the registry as a **local file** out of `node_modules` (no external host or token). Because shadcn resolves namespaced registries (`@name/item`) over HTTP, local consumption uses the direct `.json` path form of `shadcn add`. Optionally declare the namespace in `components.json` for documentation or future HTTP hosting:

```jsonc
// components.json
"registries": {
  "@fa-m8-auth": "./node_modules/@mano8/astro-auth-m8/registry/r/{name}.json"
}
```

### Items

| Item | `shadcn add` (run from the consumer project root) | registryDependencies | npm dependencies | Needs `@mano8/astro-auth-m8`? |
| :-- | :-- | :-- | :-- | :-- |
| `activity-bar-chart` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/activity-bar-chart.json` | `chart` | `recharts` | no |
| `dashboard-overview` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/dashboard-overview.json` | `card`, `skeleton`, `activity-bar-chart` | none | **yes** (`useDashboard`) |
| `account-dashboard` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/account-dashboard.json` | `button`, `skeleton`, `tabs`, `dashboard-overview` | none | **yes** (`AuthProvider`, `useAuth`) |
| `profile-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/profile-panel.json` | `card`, `button`, `input`, `label` | none | **yes** (`useAuth`, `useProfile`) |
| `sessions-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/sessions-panel.json` | `card`, `button` | `lucide-react` | **yes** (`useAuth`, `useSessions`, `useDashboard`) |
| `account-crud` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/account-crud.json` | `button`, `dialog`, `alert-dialog`, `astro-ui-m8` data-table and toast | `lucide-react` | no |
| `api-keys-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/api-keys-panel.json` | `card`, `button`, `input`, `label`, `badge`, `dialog`, `account-crud`, `astro-ui-m8` data-table | `lucide-react`, `@tanstack/react-table` | **yes** (`useApiKeys`) |
| `admin-users-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/admin-users-panel.json` | `card`, `button`, `input`, `label`, `badge`, `dialog`, `account-crud`, `astro-ui-m8` data-table | `lucide-react`, `@tanstack/react-table` | **yes** (`RequireRole`, `useUsers`) |
| `security-panel` | `npx shadcn add ./node_modules/@mano8/astro-auth-m8/registry/r/security-panel.json` | `card`, `button`, `label`, `badge`, `account-crud`, `astro-ui-m8` data-table | `lucide-react`, `@tanstack/react-table` | **yes** (`RequireRole`, `useAuditLog`, `useSecurityPurges`) |

`dashboard-overview` is the landing view; `profile-panel`, `sessions-panel`, `api-keys-panel`, `admin-users-panel`, and `security-panel` are the secondary account tabs (drop them into `account-dashboard`'s `extraTabs`, or into your own shell). Each reads its headless logic straight from the package hooks - no local adapter layer - and takes its strings via `labels`. `api-keys-panel` and `admin-users-panel` use the canonical `astro-ui-m8` data-table with client-side search, sorting, pagination, column visibility, and row selection. Their shared `account-crud` dependency is installed automatically; it supplies the popup form, destructive-action confirmation, fixed row actions, and bottom-right toast host. `admin-users-panel` self-gates with `RequireRole superuser`.

`security-panel` carries both 2.0.0 admin tiers in one tab and gates them differently, mirroring the service: the audit log is behind `RequireRole roles={["admin"]}` (role hierarchy alone, so an admin sees its own surface and a superadmin is admitted too) and the two retention purges are behind `RequireRole superuser` (dual evidence). Each purge picks its window from the closed `RetentionWindowSchema` enum and runs only through a confirmation that names what is deleted and that a window below the service's retention floor is refused - the floor is server-side configuration published by no endpoint, so the service's rejection is surfaced verbatim instead of pre-validated. A `503` locks the purge control and reports the outcome as *unknown* until the operator explicitly acknowledges having checked, so the next click can never be a blind retry. Drop it into `account-dashboard`'s `extraTabs` with `minRole: "admin"`.

Files land under `src/components/fa-auth/` (the items' `target`), import shadcn primitives via `@/components/ui/*`, and pull headless logic from the installed package. The plugin package is intentionally **not** listed in registry item `dependencies`; install the published `@mano8/astro-auth-m8` package from npm yourself so shadcn only copies the skin files.

When a copied auth skin references `@mano8/astro-ui-m8` registry items, shadcn will also copy those files into `src/components/m8-ui/` from `./node_modules/@mano8/astro-ui-m8/registry/r/*.json`.

### Consumer expectations

- shadcn configured with `style: radix-nova`, `baseColor: neutral`, `cssVariables: true`, lucide icons, and Tailwind v4 tokens in `src/styles/global.css`.
- The published `@mano8/astro-auth-m8` npm package installed and an `AuthProvider` in the tree (the dashboard hooks read the package's configured client).
- All view labels are props with English defaults - pass your own i18n strings to localize.
