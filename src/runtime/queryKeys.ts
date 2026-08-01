const authKeyRoot = ["auth"] as const;

export const authKeys = {
  all: () => authKeyRoot,
  profile: () => [...authKeyRoot, "profile"] as const,
  dashboard: (scope: "me" | "global" = "me") => [...authKeyRoot, "dashboard", scope] as const,
  users: (params?: Record<string, unknown>) => [...authKeyRoot, "users", params ?? {}] as const,
  user: (id: string) => [...authKeyRoot, "users", id] as const,
  sessions: () => [...authKeyRoot, "sessions"] as const,
  apiKeys: () => [...authKeyRoot, "apiKeys"] as const,
  adminApiKeys: (userId: string) => [...authKeyRoot, "adminApiKeys", userId] as const,
  auditLog: (params?: Record<string, unknown>) => [...authKeyRoot, "auditLog", params ?? {}] as const
} as const;
