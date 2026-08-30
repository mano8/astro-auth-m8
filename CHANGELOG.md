# Changelog

All notable changes to `@mano8/astro-auth-m8` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The major version tracks the supported `fa-auth-m8` **API contract**, not just
this package's own surface: a backend contract repoint is always a major.

## [Unreleased]

## 2.4.0

No code behaviour changes; the supported backend contract stays
`fa-auth-m8@2.0`, range `>=2.0.0 <3.0.0`. This release exists to give the
fleet a published version to pin against, because what moves here is a
**commitment**, not an implementation: `./authorization` stops being an
internal module that siblings happen to be able to reach and becomes a
supported cross-plugin import surface, with a gate holding it to the purity
that promise depends on. A consumer that only reinstalls gets byte-identical
runtime behaviour — the point of the bump is that `^2.4.0` is now the range
that *means* "this package guarantees the shared hierarchy".

### Changed

- **`./authorization` is now the fleet's shared role hierarchy** (remediation
  `W7.7`, decision 4). Nothing in the published surface changes: the module,
  its four exports and their behaviour are exactly as `2.3.0` shipped them.
  What changes is its standing. The fleet's `no-cross-plugin-import` gate
  (`C12`, `scripts/verify-fleet-gates.mjs`, carried byte-identically by all
  four plugins) now exempts this one exact specifier, so a sibling plugin can
  import the hierarchy instead of re-implementing it and pinning the copy with
  an agreement test — which is how `RBAC-06`, one hierarchy, becomes literally
  true again. Every other subpath of this package stays refused.
  A new `authorization-purity` gate makes the exemption conditional rather than
  a blanket trust: it resolves what this package publishes for
  `./authorization`, walks its import closure, and fails on React, on any bare
  dependency other than `zod`, or on any read of a runtime global. It runs here
  against this repository's own build, so keeping the module framework-neutral
  and effect-free is now a gated obligation of this repository — recorded in
  `REPOSITORY_CONTEXT.md` and in the module's own header, so it survives the
  next person who edits it.

## 2.3.0

Additive only; the supported backend contract stays `fa-auth-m8@2.0`, range
`>=2.0.0 <3.0.0`. A consumer already on `^2.2.0` resolves this release without
a manifest change; the fleet raised its floor to `^2.3.0` anyway, because the
refresh coordination below is behaviour its consumers depend on rather than an
optimisation they can afford to miss.

### Fixed

- **The two refresh paths are coordinated** (remediation `W3.1`).
  `AuthProvider`'s bootstrap called `refreshToken()` directly, bypassing the
  `runRefresh` single-flight guard in `tokenStore.ts` that `client.ts`'s own
  `401`-triggered refresh uses. Two independent guards over one *rotating*
  token let a page mounting both paths against one expired token issue two
  rotations — which `fa-auth-m8` correctly reads as token reuse and answers by
  revoking every session for that account. `bootstrapSession()` now goes
  through `runRefresh`, so whichever path reaches it first performs the
  request and the other piggybacks on its resolved token. The existing
  `bootstrapFailureUntil` cooldown is untouched; it is a separate concern
  layered on top.
- **A transient failure no longer poisons the session hint.** The bootstrap
  catch recorded "no session" on *any* error, and the hint has no expiry, so a
  single `500` or one offline load made every later page load skip its refresh
  and left a validly signed-in user looking signed out until they signed in by
  hand. Only a `401` records the negative now; every other failure keeps the
  retryable cooldown, which lapses and recovers on its own.
- **A session established outside `AuthProvider.login` clears the hint.** The
  plugin's own `CallbackView` — and, more to the point, `fa-ui-m8`'s
  `useGoogleLogin`, which calls `exchangeGoogleCode` + `setToken` directly and
  then hard-navigates — never reached the provider's `login`, so a Google
  sign-in after any earlier `401` landed on a page that skipped its bootstrap
  and rendered as signed out. Rather than patch each UI, the hint now lives
  beside `setToken`/`clearToken` at the points that actually establish or
  destroy a session: login, logout, an honoured `refreshToken` (the only auth
  call the sibling plugins make, through `installFaAuthBrowserAdapter`), a
  completed OAuth exchange, and `client.ts`'s `401`-triggered rotation. Every
  consumer is covered with no host change.
- **Every Web Storage access is guarded.** These are core sign-in paths, so an
  environment with no `localStorage` — or one refusing access to it — must lose
  the optimisation and never the sign-in.

### Added

- **A negative-only session hint** (`src/runtime/sessionHint.ts`, remediation
  `W3.2`). The provider's bootstrap called `refreshToken()` unconditionally on
  every page load, including for a browser with no session at all.
  `fa-auth-m8`'s `refresh_token` cookie is `HttpOnly`, so this runtime cannot
  read it to find out, and `fa-auth-m8` behaviour changes were out of scope —
  hence a client-owned substitute that only ever records the *negative*. It is
  cleared by default and on a successful login or bootstrap, and set only once
  a bootstrap refresh has actually been refused, or on logout.
  `bootstrapSession()` then skips the refresh call outright, with no network
  request. An unset hint still always attempts the refresh exactly as before,
  so a browser carrying a still-valid cookie from before this release is never
  signed out on a guess. **This adds one `localStorage` key**, which is why
  this release is a minor rather than a patch.

### Changed

- **`AuthProvider` is split into an outer component and `AuthProviderInner`**,
  the inner one rendered inside `AuthQueryProvider` so it can reach
  `useQueryClient()`. A new `applyUser` callback replaces every direct
  `setUser` call and additionally seeds
  `queryClient.setQueryData(authKeys.profile(), profile)`, so a screen's own
  `useProfile()` reads the provider's already-resolved profile from cache
  instead of firing a second identity request for one answer.
- Internal only: the tarball smoke test resolves the npm CLI on POSIX, and the
  registry command fixture is aligned with `@mano8/astro-ui-m8` `1.5.0`.

## 2.2.0

Additive only; the supported backend contract stays `fa-auth-m8@2.0`, range
`>=2.0.0 <3.0.0`.

### Added

- **`AuthErrorBoundary` from `./react`**, with a safe default fallback, custom
  fallback and reporting hooks, retry support, and reset keys. Every starter
  island root now mounts beneath this boundary so a render failure leaves a
  usable recovery surface instead of a blank login, signup, callback, account,
  or logout region.
- **A dev-only `/_preview` gallery** for exercising every auth island against a
  deterministic in-browser service stub. Run it with `npm run preview:dev`;
  `npm run preview:build` typechecks and bundles the same gallery in CI.
- **Standalone package-consumer gates** for generated registry skins and the
  packed tarball, plus fleet-alignment and registry-drift checks in CI.

### Changed

- Raised the runtime dependency on `@mano8/astro-ui-m8` from `^1.4.2` to
  `^1.5.0`, the published shared-UI release required by the registry gates.
- Expanded linting to the maintained repository surface and kept development
  dependencies inside the high-severity audit that protects the build and
  signing environment.

## 2.1.0

Additive only; the supported backend contract stays `fa-auth-m8@2.0`, range
`>=2.0.0 <3.0.0`.

### Added

- **`RequireRole minimumRole`**, an explicit minimum-role mode:
  `minimumRole="admin"` renders when the signed-in role meets or exceeds
  `admin` on the ordered hierarchy. It decides identically to
  `roles={["admin"]}` — each array entry has been a floor since 2.0.0 — but
  says what the backend dependency says instead of reading as exact membership,
  so a consumer expressing a single floor no longer hand-enumerates a role
  array. `roles` is unchanged and stays for guards that accept several
  unrelated tiers; `superuser` remains the separate dual-evidence gate. A guard
  may carry more than one mode and grants on the first that holds; one carrying
  no mode grants nothing, as before.
- **`hasMinimumRole`, `hasSuperuserPrivileges`, `privilegeClaimsAreConsistent`
  and `ORDERED_ROLES` re-exported from `./react`**, as the same bindings the
  `./authorization` subpath exports — not a second implementation. Gating
  something that is not a subtree (a menu entry, a row action, a `disabled`
  attribute) now reaches the comparison from the subpath the guard already
  comes from.

### Changed

- `security-panel` gates its audit-log read with `minimumRole="admin"` rather
  than `roles={["admin"]}`. Behaviour is identical; the copied file and the
  `registry/r` output both change, so a consumer re-adding the block picks up
  the new spelling.
- `compatibility.test.ts` now pins the published `faAuthM8` package-metadata
  block against the `compatibility.ts` constants, so the machine-readable half
  of the contract claim cannot drift from the half the browser preflight
  enforces.

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
