# astro-auth-m8

## Authority

Read the workspace root `AGENTS.md` first. This repo follows the workspace
TypeScript/client policy; use workspace `.Codex/` plus this repo's `AGENTS.md`.

## Role

Required baseline Astro plugin for `fa-ui-m8` and any M8 Astro app that needs
`fa-auth-m8`.

Owns the auth frontend contract: schemas, API wrappers, token handling, React
provider/hooks, route helpers, compatibility checks, neutral default UI, and
shadcn registry skins usable by `fa-ui-m8`.

## Boundaries

- Talk to `fa-auth-m8` over HTTP only; never import service code.
- Keep access tokens in memory only. Refresh uses `credentials: "include"`.
- Model public backend responses only; never expose secret/session fields.
- Keep `package.json` `faAuthM8`, schemas, and compatibility checks aligned.
- Export public modules through explicit `package.json` subpaths.
- Registry skins use pure shadcn/Tailwind patterns where possible and import live
  logic from this package's `/react` and `/hooks` exports.
- The account landing view is a dashboard; profile, sessions, API keys, and admin
  panels are secondary surfaces.
- Consumers own secrets, env, i18n labels, and final composition.

## Commands

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run test:unit`



