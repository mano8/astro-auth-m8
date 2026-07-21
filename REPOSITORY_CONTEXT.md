# astro-auth-m8

## Layer

Client (Astro authentication plugin).

## Role

Provide the Astro integration and headless runtime client for `fa-auth-m8`. This
is the foundation authentication plugin for `fa-ui-m8` and other M8 Astro apps.

## Backend and public contract

- Communicate with `fa-auth-m8` over HTTP only; never import service code.
- Publish `@mano8/astro-auth-m8` and keep the `faAuthM8` package metadata,
  schemas, and compatibility checks aligned with the supported backend contract.
- The current public backend contract is `fa-auth-m8@1.0`, tested with service
  version `1.1.0` and supporting `>=1.0.0 <2.0.0`.
- Export public modules only through explicit `package.json` subpaths.
- Preserve the adapter and provider surface as a stable fleet boundary; breaking
  changes have fleet-wide consequences.

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
