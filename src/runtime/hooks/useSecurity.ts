import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getAuditLog, purgeApiKeys, purgeAuditLog } from "../api/security.js";
import { refetchOrThrow } from "./queryHelpers.js";
import { authKeys } from "../queryKeys.js";
import type { PrivilegedActionAuditPublic, PurgeRequest } from "../schemas.js";

// Admin-tier read (AA-14): gate with `hasMinimumRole(role, "admin")`, not the
// superuser predicate — the own-rows/all-rows split is decided server-side
// from the authenticated principal and is never sent by this client.
export function useAuditLog(params: { skip?: number; limit?: number } = {}, load = true) {
  const auditLogQuery = useQuery({
    queryKey: authKeys.auditLog(params),
    queryFn: () => getAuditLog(params),
    enabled: load,
    staleTime: 30_000
  });
  const { refetch } = auditLogQuery;

  const reload = useCallback(() => refetchOrThrow(refetch, null), [refetch]);

  const rows: PrivilegedActionAuditPublic[] = auditLogQuery.data?.data ?? [];
  const count = auditLogQuery.data?.count ?? 0;
  const loading = auditLogQuery.isLoading || auditLogQuery.isFetching;

  return {
    rows,
    count,
    loading,
    error: auditLogQuery.error ?? null,
    reload,
    isLoading: auditLogQuery.isLoading,
    isFetching: auditLogQuery.isFetching,
    refetch: auditLogQuery.refetch
  };
}

// Superadmin-only maintenance actions (AA-18, AA-19): both purges are
// idempotent-unsafe, rate limited (429), and fail-closed on 503 — the caller
// must treat a 503 outcome as unknown, never retry it automatically, and
// surface a 400 retention-floor rejection verbatim. This hook performs no
// such interpretation itself; it only invalidates the affected list on a
// confirmed success.
export function useSecurityPurges() {
  const queryClient = useQueryClient();

  const purgeAuditLogMutation = useMutation({
    mutationFn: (body: PurgeRequest) => purgeAuditLog(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.auditLog() });
    }
  });
  const purgeApiKeysMutation = useMutation({
    mutationFn: (body: PurgeRequest) => purgeApiKeys(body)
  });

  const { mutateAsync: purgeAuditLogAsync } = purgeAuditLogMutation;
  const { mutateAsync: purgeApiKeysAsync } = purgeApiKeysMutation;

  const purgeAudit = useCallback((window: PurgeRequest["window"]) => purgeAuditLogAsync({ window }), [purgeAuditLogAsync]);
  const purgeKeys = useCallback((window: PurgeRequest["window"]) => purgeApiKeysAsync({ window }), [purgeApiKeysAsync]);

  return {
    purgeAudit,
    purgeKeys,
    purgeAuditLogMutation,
    purgeApiKeysMutation
  };
}
