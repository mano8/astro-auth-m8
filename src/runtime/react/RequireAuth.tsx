import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider.js";

export function RequireAuth({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return fallback;
  return user ? children : fallback;
}
