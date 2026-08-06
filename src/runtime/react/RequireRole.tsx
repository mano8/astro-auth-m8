import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider.js";
import type { RoleType } from "../schemas.js";
import { hasMinimumRole, hasSuperuserPrivileges } from "../authorization.js";

export type RequireRoleProps = {
  children: ReactNode;
  /**
   * Minimum-role mode: render when the signed-in role meets or exceeds this
   * one on the ordered hierarchy (`hasMinimumRole`).
   *
   * This is the form to reach for. `minimumRole="admin"` says what the backend
   * dependency says - *at least* admin - where the equivalent `roles={["admin"]}`
   * reads as exact membership and only behaves as a floor because this guard
   * compares hierarchically. Consumers were hand-enumerating role arrays to
   * express a floor; a single role is the honest spelling of it (`RBAC-06`).
   */
  minimumRole?: RoleType;
  /**
   * Any-of mode: render when the signed-in role meets or exceeds *any* listed
   * role. Each entry is still a floor, not an exact match, so
   * `roles={["admin"]}` admits a `superadmin`.
   *
   * Kept for guards that genuinely accept several unrelated tiers. For a single
   * floor, prefer {@link minimumRole}.
   */
  roles?: RoleType[];
  /**
   * Superuser mode: render only on dual evidence (`role === "superadmin"` and
   * `is_superuser === true`), never on either claim alone.
   */
  superuser?: boolean;
  fallback?: ReactNode;
};

/**
 * Render `children` when the signed-in user satisfies any supplied mode.
 *
 * The modes are a union, evaluated independently, so a guard carrying more
 * than one grants on the first that holds. With no mode supplied nothing is
 * granted - an unqualified guard is a mistake, and failing closed makes it a
 * visible one.
 *
 * Every comparison goes through `../authorization.js`, this package's single
 * encoding of the hierarchy and of the `role`/`is_superuser` invariant. The
 * backend remains the authority; this only keeps the UI from offering surfaces
 * the service would refuse.
 */
export function RequireRole({ children, minimumRole, roles, superuser = false, fallback = null }: RequireRoleProps) {
  const { user, loading } = useAuth();
  if (loading || !user) return fallback;
  if (superuser && hasSuperuserPrivileges(user.role, user.is_superuser)) return children;
  if (minimumRole && hasMinimumRole(user.role, minimumRole)) return children;
  if (roles?.some((requiredRole) => hasMinimumRole(user.role, requiredRole))) return children;
  return fallback;
}
