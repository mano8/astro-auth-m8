# Changelog

All notable changes to `@mano8/astro-auth-m8` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The major version tracks the supported `fa-auth-m8` **API contract**, not just
this package's own surface: a backend contract repoint is always a major.

## 2.0.0

Aligns the plugin with the `fa-auth-m8@2.0` contract (service `2.0.0`,
supported range `>=2.0.0 <3.0.0`). **A `1.x` host cannot talk to a `2.0.0`
backend and a `2.0.0` host cannot talk to a `1.x` backend** — upgrade both
together.

### Breaking

- **Supported backend contract is now `fa-auth-m8@2.0`**, range
  `>=2.0.0 <3.0.0` (was `fa-auth-m8@1.0`, `>=1.0.0 <2.0.0`). `compatibility.ts`
  constants, the `faAuthM8` package metadata block, and the README all move
  together.
- **`is_superuser` is no longer accepted on user creation.** It was removed from
  `UserCreateSchema` and from the admin create form. `fa-auth-m8` 2.0.0 derives
  the flag server-side from `role` and returns `422` on *any* submitted
  `is_superuser` — `true` or `false`. It remains on `UserPublic` as a response
  field, because the superuser predicate requires both claims as evidence.
- **`RequireRole roles={...}` is now an ordered-hierarchy check, not exact
  membership.** `roles={["admin"]}` now also admits a `superadmin`. Previously a
  superadmin was denied every admin-tier surface. If you relied on exact-role
  matching, compare `user.role` yourself.
- **`RequireRole superuser` now requires dual evidence.** It grants only when
  `role === "superadmin"` **and** `is_superuser === true`, via
  `hasSuperuserPrivileges`. A row carrying an inconsistent pair (possible on
  data written before 2.0.0's consistency constraint) is now denied instead of
  granted on the flag alone.
- **`PATCH /users/update/{id}/` now parses as `UserAuthorizationUpdate`**
  (`UserPublic` plus required `auth_generation` and `revocation_enqueued`).
  `useUsers().update` returns `Promise<UserAuthorizationUpdate>`; anything typed
  against `UserPublic` needs widening.
- **`ApiKeyPublic` / `ApiKeyCreated` gained required `access_mode` and
  `audiences`.** Both schemas are `.strict()`, so a `1.x` backend response no
  longer parses.
- **Registry block change (affects copied files):** `errorMessage(error,
  fallback)` in `registry/blocks/account/account-crud.tsx` now returns a
  `ToastNotification` (`{ title, description? }`) instead of a `string`. If you
  copied the account blocks at `1.x` and re-add them, update call sites from
  `accountToast.error({ title: errorMessage(e, f) })` to
  `accountToast.error(errorMessage(e, f))`.

### Added

- `./authorization` subpath: `hasMinimumRole`, `hasSuperuserPrivileges`,
  `privilegeClaimsAreConsistent`, `ORDERED_ROLES` — the TypeScript mirror of
  `auth_sdk_m8/authorization.py`, and the only place this package encodes the
  role hierarchy or the `role`/`is_superuser` invariant.
- `./errors` subpath: `describeApiError(error, fallback)`, mapping the 2.0.0
  authorization, rate-limit and retention error contracts to operator-readable
  `{ title, description? }`. `409 last_superuser_required` is labelled and the
  raw token never surfaces; `429` (not attempted) and `503` (outcome unknown,
  do not retry) are kept distinct; a `400` retention-floor rejection is
  surfaced verbatim rather than pattern-matched.
- Wrappers and hooks for the five new 2.0.0 admin routes: `useAdminApiKeys`
  (superadmin list/revoke of another user's keys, metadata only),
  `useAuditLog` (admin-tier privileged-action trail), `useSecurityPurges`
  (superadmin retention purges). `GET /security/superuser-probe` is
  deliberately not wrapped — it is the `security-tests-m8` harness canary.
- `security-panel` registry item, carrying both admin tiers behind the two
  different predicates the service uses: the audit-log read behind
  `RequireRole roles={["admin"]}` (role hierarchy) and both purges behind
  `RequireRole superuser` (dual evidence).
- `AccountTab.minRole` on `account-dashboard`, so an admin-tier tab is
  representable in the account shell alongside the existing `superuserOnly`.
- `is_active` on `UserUpdateSchema`, plus an admin Status control behind a
  dedicated confirmation naming the consequence (generation bump, session
  revocation, and on deactivation an API-key revocation that reactivation does
  not undo). It submits as its own isolated mutation, never bundled into a
  general field edit.
- Revocation handling: a `revocation_enqueued: true` response invalidates the
  affected auth caches and emits `AUTH_REVOCATION_EVENT`. A mounted
  `AuthProvider` re-reads the profile for the signed-in principal, raising
  `loading` so guards fall back instead of rendering privileged UI from
  superseded claims. The backend remains the authority; this only stops a stale
  client view outliving the change.
- Automatic compatibility preflight: `installFaAuthBrowserAdapter` calls the
  public `GET {apiBase}/meta` once per install and **warns** on a contract or
  version mismatch. It is advisory and fire-and-forget — it never blocks or
  fails adapter setup, and a fetch failure is ignored. Hosts that want to fail
  closed can still call `assertFaAuthM8Compatibility` themselves. Note this
  adds one unauthenticated request per page load, including for anonymous
  visitors.
- `access_mode` and `audiences` columns plus explicit creation controls on the
  owner-facing API-keys panel.

### Fixed

- The compatibility preflight now checks the issuer id on the nested
  `GET /meta` `contract` object, not only its version. Every M8 service serves
  the same payload shape from the shared `mount_service_meta` helper, so a host
  pointed at the wrong sibling was previously reported compatible whenever the
  contract versions happened to match.
- `403` is now titled by status (`Not permitted`) with the backend's readable
  detail as the description, instead of asserting a role-change cause that was
  wrong for an audit-log or purge `403`.
- Test fixtures no longer certify an impossible `role: "admin"` /
  `is_superuser: true` pair as a superuser.

### Internal

- The 100% coverage gate now measures `src/runtime/react/**` and
  `src/runtime/hooks/**`, which were previously excluded — including
  `RequireRole` and the hook layer that carries revocation handling.

## 1.5.0 and earlier

See the Git history and GitHub releases for `v1.5.0` and prior tags; this file
was introduced with the `2.0.0` release.
