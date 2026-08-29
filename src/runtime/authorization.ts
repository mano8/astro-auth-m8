/**
 * Framework-neutral role/flag authorization primitives.
 *
 * TypeScript mirror of `auth_sdk_m8/authorization.py`, the canonical source.
 * Canonical role/flag truth table (one row per valid state):
 *
 * ```text
 * role         is_superuser=false    is_superuser=true
 * user         valid, non-superuser  invalid
 * reader       valid, non-superuser  invalid
 * writer       valid, non-superuser  invalid
 * admin        valid, non-superuser  invalid
 * superadmin   invalid               valid superuser
 * ```
 *
 * No caller may derive an authorization decision from `role` alone or
 * `is_superuser` alone - the two claims must agree. This module is the single
 * place in the package that encodes the hierarchy and the cross-field
 * invariant, so every consumer (components, hooks, registry skins) shares one
 * implementation.
 *
 * These are client-side display predicates. The backend remains the authority;
 * mirroring its rules here only stops the UI from showing privileged surfaces
 * the server would refuse.
 *
 * **This module is shared with the rest of the plugin fleet.** `./authorization`
 * is the one subpath of this package a sibling business plugin may import: the
 * fleet's `no-cross-plugin-import` gate (`C12`) exempts that exact specifier so
 * `RBAC-06` — one role hierarchy across the fleet — is met by an import rather
 * than by a copy each plugin has to pin with a test. The exemption is
 * conditional on this file staying pure, and the `authorization-purity` gate in
 * `scripts/verify-fleet-gates.mjs` enforces it in all four plugins: it walks
 * this module's import closure and fails on React, on any bare dependency other
 * than `zod`, or on any read of a runtime global. Keep it framework-neutral and
 * effect-free — anything else here breaks every sibling plugin's build.
 */

import { RoleTypeSchema, type RoleType } from "./schemas.js";

/**
 * Roles ordered from highest to lowest privilege.
 *
 * Sourced from `RoleTypeSchema` so the hierarchy exists as exactly one list in
 * this package, mirroring `RoleType.get_ordered_roles()`. The schema declares
 * its members in descending privilege order; `tests/authorization.test.ts`
 * locks that order in so a reordering of the enum fails loudly instead of
 * silently changing every authorization decision.
 */
export const ORDERED_ROLES: readonly RoleType[] = RoleTypeSchema.options;

/** The single role that carries superuser authority. */
const SUPERADMIN_ROLE: RoleType = "superadmin";

/**
 * Whether `role` is a role this build recognises.
 *
 * The type system already constrains typed call sites, but this package is
 * published to JavaScript consumers and its claims originate from a backend
 * that may be newer than the client. An unrecognised role is not on the truth
 * table, so it is treated as no privilege at all rather than guessed at.
 */
function isKnownRole(role: RoleType): boolean {
  return ORDERED_ROLES.includes(role);
}

/**
 * Return whether `currentRole` meets or exceeds `requiredRole`.
 *
 * Canonical role hierarchy check, ordered highest to lowest privilege via
 * {@link ORDERED_ROLES}. This is the single implementation of the hierarchy;
 * no consumer should duplicate a role-ordered list or compare roles by exact
 * membership - exact membership hides an admin surface from a superadmin.
 *
 * Returns `false` for an insufficient or unrecognised role.
 */
export function hasMinimumRole(currentRole: RoleType, requiredRole: RoleType): boolean {
  const current = ORDERED_ROLES.indexOf(currentRole);
  const required = ORDERED_ROLES.indexOf(requiredRole);
  if (current === -1 || required === -1) return false;
  return current <= required;
}

/**
 * Return whether `role` and `isSuperuser` agree per the truth table.
 *
 * Pure cross-field invariant, independent of any hierarchy comparison:
 *
 * - `superadmin` requires `isSuperuser === true`.
 * - Every other recognised role requires `isSuperuser === false`.
 *
 * Returns `true` only when the pair is one of the five valid rows. The claims
 * are compared strictly (`=== true` / `=== false`) rather than by truthiness,
 * so a JavaScript consumer passing an unparsed value cannot widen the
 * invariant.
 *
 * Deviation from the Python original, deliberate: `auth_sdk_m8` types `role`
 * as a closed enum, so an unrecognised role cannot reach it and the final
 * branch treats every non-superadmin input as valid. Here the claims may come
 * from a backend this build does not know, so an unrecognised role is not one
 * of the five rows and fails closed.
 */
export function privilegeClaimsAreConsistent(role: RoleType, isSuperuser: boolean): boolean {
  if (!isKnownRole(role)) return false;
  if (role === SUPERADMIN_ROLE) return isSuperuser === true;
  return isSuperuser === false;
}

/**
 * Return the exact dual-evidence canonical-superuser predicate.
 *
 * Requires both the consistency invariant and the canonical pair
 * (`role === "superadmin"` and `isSuperuser === true`). Callers must use this
 * instead of reading `is_superuser` or `role` alone - a stray
 * `is_superuser: true` on a non-superadmin role (or vice versa) never grants
 * superuser privileges. Such mismatched pairs are not hypothetical: they exist
 * on rows written before `fa-auth-m8` 2.0.0 added its consistency constraint,
 * for the length of the expand/repair migration window.
 */
export function hasSuperuserPrivileges(role: RoleType, isSuperuser: boolean): boolean {
  return privilegeClaimsAreConsistent(role, isSuperuser)
    && role === SUPERADMIN_ROLE
    && isSuperuser === true;
}
