import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { getCurrentSession, listSessions, revokeSession } from "../api/sessions.js";
import { authKeys } from "../queryKeys.js";
import type { ClientSessionPublic, ClientSessionsPublic } from "../schemas.js";

const currentSessionKey = [...authKeys.sessions(), "current"] as const;

export function useSessions(load = true) {
  const sessionsQuery = useQuery({
    queryKey: authKeys.sessions(),
    queryFn: () => listSessions(),
    enabled: load,
    staleTime: 30_000
  });
  const currentQuery = useQuery({
    queryKey: currentSessionKey,
    queryFn: getCurrentSession,
    enabled: false,
    staleTime: 30_000
  });

  const reload = useCallback(async () => {
    const result = await sessionsQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [sessionsQuery]);

  const reloadCurrent = useCallback(async () => {
    const result = await currentQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [currentQuery]);

  const revoke = useCallback((id: string) => revokeSession(id), []);

  const sessions: ClientSessionsPublic | null = sessionsQuery.data ?? null;
  const current: ClientSessionPublic | null = currentQuery.data ?? null;
  const loading = sessionsQuery.isLoading || sessionsQuery.isFetching || currentQuery.isFetching;
  const error = sessionsQuery.error ?? currentQuery.error;

  return {
    sessions,
    current,
    loading,
    error,
    reload,
    reloadCurrent,
    revoke,
    isLoading: sessionsQuery.isLoading,
    isFetching: sessionsQuery.isFetching || currentQuery.isFetching,
    refetch: sessionsQuery.refetch
  };
}
