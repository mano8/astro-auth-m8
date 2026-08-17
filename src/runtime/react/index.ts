// Announced by the hook layer on a `revocation_enqueued` response and consumed
// by `AuthProvider`; re-exported here so a consumer with its own mutation layer
// can announce one through an existing public subpath.
export { AUTH_REVOCATION_EVENT, emitAuthRevocation, type AuthRevocationDetail } from "../authEvents.js";
export * from "./AuthQueryProvider.js";
export * from "./AuthProvider.js";
export * from "./RequireAuth.js";
export * from "./RequireRole.js";
// The hierarchy primitives, re-exported alongside `RequireRole` so a consumer
// gating something that is not a subtree - a menu entry, a table row action, a
// disabled attribute - reaches the same comparison from the same subpath it
// already imports the guard from, instead of hand-rolling a role-ordered list
// (`RBAC-06`). `./authorization` remains the framework-neutral home; these are
// the same bindings, not a second implementation.
export { ORDERED_ROLES, hasMinimumRole, hasSuperuserPrivileges, privilegeClaimsAreConsistent } from "../authorization.js";
