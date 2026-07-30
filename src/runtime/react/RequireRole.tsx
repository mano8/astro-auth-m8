import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider.js";
import type { RoleType } from "../schemas.js";
import { hasMinimumRole, hasSuperuserPrivileges } from "../authorization.js";

export function RequireRole({ children, roles, superuser = false, fallback = null }: { children: ReactNode; roles?: RoleType[]; superuser?: boolean; fallback?: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) return fallback;
  if (superuser && hasSuperuserPrivileges(user.role, user.is_superuser)) return children;
  if (roles?.some((requiredRole) => hasMinimumRole(user.role, requiredRole))) return children;
  return fallback;
}
