import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getCurrentSession, listSessions, revokeSession } from "../api/sessions.js";
import { refetchOrThrow } from "./queryHelpers.js";
import { authKeys } from "../queryKeys.js";
import type { ClientSessionPublic, ClientSessionsPublic } from "../schemas.js";

const currentSessionKey = [...authKeys.sessions(), "current"] as const;

export function useSessions(load = true) {
  const queryClient = useQueryClient();
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
  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    }
  });
  const { refetch: refetchSessions } = sessionsQuery;
  const { refetch: refetchCurrent } = currentQuery;
  const { mutateAsync: revokeSessionAsync } = revokeMutation;

  const reload = useCallback(() => refetchOrThrow(refetchSessions, null), [refetchSessions]);

  const reloadCurrent = useCallback(() => refetchOrThrow(refetchCurrent, null), [refetchCurrent]);

  const revoke = useCallback((id: string) => revokeSessionAsync(id), [revokeSessionAsync]);

  const sessions: ClientSessionsPublic | null = sessionsQuery.data ?? null;
  const current: ClientSessionPublic | null = currentQuery.data ?? null;
  const loading = sessionsQuery.isLoading || sessionsQuery.isFetching || currentQuery.isFetching;
  const error = sessionsQuery.error ?? currentQuery.error;

  return {
    sessions,
    current,
    loading,
    error: error ?? null,
    reload,
    reloadCurrent,
    revoke,
    revokeMutation,
    isLoading: sessionsQuery.isLoading,
    isFetching: sessionsQuery.isFetching || currentQuery.isFetching,
    refetch: sessionsQuery.refetch
  };
}
