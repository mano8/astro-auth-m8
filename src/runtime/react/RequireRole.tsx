import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider.js";
import type { RoleType } from "../schemas.js";

export function RequireRole({ children, roles, superuser = false, fallback = null }: { children: ReactNode; roles?: RoleType[]; superuser?: boolean; fallback?: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) return fallback;
  if (superuser && user.is_superuser) return children;
  if (roles?.includes(user.role)) return children;
  return fallback;
}
