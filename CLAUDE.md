# astro-auth-m8

> Shared plugin rules live in `/.claude/context/astro-plugin.md` (repo type
> `astro-plugin`). This file lists ONLY what is specific to astro-auth-m8.

## Role in the fleet

**Foundation plugin.** Required by the host (`fa-ui-m8`) and by every other
Astro plugin. Owns authentication for the fleet: no other plugin re-implements
it — they consume the `fa-auth-astro` provider / `*AuthAdapter` exposed here.

## Backend

Fronts **`fa-auth-m8`** over its HTTP API. Pinned to the `fa-auth-m8@0.9`
contract (tested `0.9.7`, range `>=0.9.0 <0.10.0`; see `faAuthM8` in
`package.json`). Published as `@mano8/astro-auth-m8`.

## Modes

- `headless` — schemas, API wrappers, token handling, provider/hooks, route
  helpers; no pages injected (host default).
- `starter` — injects login/signup/logout/callback/account routes.
- `scaffold` — copies editable Astro/React/CSS into the consumer via the
  `bin/astro-auth-m8.ts` CLI.

## Repo-specific structure (beyond the canonical layout)

- `src/runtime/api/**` — auth, oauth, sessions, users, profile, apiKeys,
  dashboard, ops wrappers.
- `src/runtime/tokenStore.ts` — in-memory access-token store.
- `src/runtime/react/**` — `AuthProvider`, `RequireAuth`, `RequireRole`,
  `default-ui/*` views.
- `src/scaffold/**` — `styles/`, `views/`, `i18n/` copied during `scaffold`.
- `registry/` — shadcn skins consumed by hosts via `components.json`.

## Repo-specific rules

- Access tokens live in memory only — never persist to `localStorage`/cookies
  from here.
- Refresh uses `credentials: "include"`; model only public backend responses
  (no secret/session fields).
- This is the auth boundary the whole fleet depends on: keep the adapter /
  provider surface stable; treat breaking changes to it as fleet-wide.
