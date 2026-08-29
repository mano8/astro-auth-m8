# astro-auth-m8

## Layer

Client (Astro authentication plugin).

## Purpose

Provide the Astro integration and headless runtime client for `fa-auth-m8`. This
is the foundation authentication plugin for `fa-ui-m8` and other M8 Astro apps.

## Responsibilities

- Model the public authentication contract and issue HTTP requests through the
  package-owned runtime client.
- Provide token handling, providers, hooks, route helpers, and optional default
  or scaffolded UI without moving consumer-owned configuration into the package.
- Keep published metadata and compatibility checks synchronized with the
  supported `fa-auth-m8` service contract.

## Repository boundaries

- Own this package's Astro integration, headless client, schemas, runtime
  adapter, starter routes, copied scaffold, registry skins, and tests.
- Do not import `fa-auth-m8` service code or another optional plugin; service
  access remains HTTP-only and other plugins use the public adapter/provider
  surface.
- Consumers own secrets, environment configuration, i18n labels, navigation,
  and final UI composition.

## Backend and public contract

- Communicate with `fa-auth-m8` over HTTP only; never import service code.
- Publish `@mano8/astro-auth-m8` and keep the `faAuthM8` package metadata,
  schemas, and compatibility checks aligned with the supported backend contract.
- The current public backend contract is `fa-auth-m8@2.0`, tested with service
  version `2.0.0` and supporting `>=2.0.0 <3.0.0`.
- Export public modules only through explicit `package.json` subpaths.
- Preserve the adapter and provider surface as a stable fleet boundary; breaking
  changes have fleet-wide consequences.
- `./authorization` is the fleet's one role hierarchy, and the only subpath of
  this package another business plugin may import. It is the TypeScript mirror
  of `auth_sdk_m8/authorization.py`: `ORDERED_ROLES`, `hasMinimumRole`,
  `privilegeClaimsAreConsistent`, `hasSuperuserPrivileges` and nothing else.
  The fleet's `no-cross-plugin-import` gate (`C12`,
  `scripts/verify-fleet-gates.mjs`) exempts that one exact specifier so
  `RBAC-06` — one hierarchy — can be met by an import rather than by a copy;
  every other subpath stays refused, so a sibling plugin never reaches this
  package's runtime, React surface or integration through it. The exemption is
  conditional and gated: `authorization-purity`, carried byte-identically by
  all four plugins, walks this module's import closure and fails on React, on
  any bare dependency but `zod`, or on any runtime global. **Keeping that
  module pure and framework-neutral is therefore a fleet obligation of this
  repository**, not a local style preference — a `react` import or a `window`
  read inside its closure breaks every sibling's build, by design.

## Package version alignment

- Keep `package.json` and `package-lock.json` on the same published version.
- When the package version changes, retain the supported `fa-auth-m8` contract
  range unless the schemas and compatibility checks change together.

## Authentication and UI boundaries

- Keep access tokens in memory only. Refresh uses `credentials: "include"`.
- Model public backend responses only; never expose secret or session fields.
- Provide headless schemas, API wrappers, token handling, provider/hooks, and
  route helpers. `starter` adds default login, logout, callback, and account
  routes; `scaffold` copies editable Astro, React, and CSS files into a consumer.
- The runtime surface is rooted in `src/runtime/`; `src/scaffold/` contains
  copied styles, views, and i18n assets, while `registry/` contains shadcn skins
  consumed through `components.json`.
- Registry skins use shadcn and Tailwind patterns where practical, while importing
  live logic from this package's `/react` and `/hooks` exports.
- Keep the account landing view dashboard-focused; profile, sessions, API keys,
  and administrative panels are secondary surfaces.
- Consumers own secrets, environment configuration, i18n labels, and final UI
  composition. Keep views responsive, mobile-first, and modern.

## Repository commands

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run test:unit`

## Standalone authority

This file, repository documentation, and existing CI are the authoritative local
context. A verified nearest workspace may optionally add launcher-selected
policies and tasks; its absence is a successful standalone condition and does not
make a parent workspace necessary.
