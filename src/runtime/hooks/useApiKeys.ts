import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { adminListUserApiKeys, adminRevokeApiKey, createApiKey, listApiKeys, revokeApiKey } from "../api/apiKeys.js";
import { refetchOrThrow } from "./queryHelpers.js";
import { authKeys } from "../queryKeys.js";
import type { ApiKeyAdminPublic, ApiKeyCreate, ApiKeyCreated, ApiKeyPublic } from "../schemas.js";

export function useApiKeys(load = true) {
  const queryClient = useQueryClient();
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const apiKeysQuery = useQuery({
    queryKey: authKeys.apiKeys(),
    queryFn: listApiKeys,
    enabled: load,
    staleTime: 30_000
  });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: async (key) => {
      setCreatedKey(key);
      await queryClient.invalidateQueries({ queryKey: authKeys.apiKeys() });
    }
  });
  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.apiKeys() });
    }
  });
  const { refetch } = apiKeysQuery;
  const { mutateAsync: createApiKeyAsync } = createMutation;
  const { mutateAsync: revokeApiKeyAsync } = revokeMutation;

  const reload = useCallback(() => refetchOrThrow(refetch, [] as ApiKeyPublic[]), [refetch]);

  const create = useCallback((body: ApiKeyCreate) => createApiKeyAsync(body), [createApiKeyAsync]);
  const revoke = useCallback((id: string) => revokeApiKeyAsync(id), [revokeApiKeyAsync]);

  const apiKeys: ApiKeyPublic[] = apiKeysQuery.data ?? [];
  const loading = apiKeysQuery.isLoading || apiKeysQuery.isFetching;

  return {
    apiKeys,
    createdKey,
    loading,
    error: apiKeysQuery.error ?? null,
    reload,
    create,
    revoke,
    createMutation,
    revokeMutation,
    isLoading: apiKeysQuery.isLoading,
    isFetching: apiKeysQuery.isFetching,
    refetch: apiKeysQuery.refetch
  };
}

// Superadmin-only surface (AA-13, AA-17): list + revoke another user's keys.
// Metadata only — never the raw or hashed key — and there is no create/edit
// path here, unlike the owner-scoped `useApiKeys` above.
export function useAdminApiKeys(userId: string, load = true) {
  const queryClient = useQueryClient();
  const adminKeysQuery = useQuery({
    queryKey: authKeys.adminApiKeys(userId),
    queryFn: () => adminListUserApiKeys(userId),
    enabled: load && Boolean(userId),
    staleTime: 30_000
  });

  const revokeMutation = useMutation({
    mutationFn: adminRevokeApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.adminApiKeys(userId) });
    }
  });
  const { refetch } = adminKeysQuery;
  const { mutateAsync: revokeApiKeyAsync } = revokeMutation;

  const reload = useCallback(() => refetchOrThrow(refetch, null), [refetch]);
  const revoke = useCallback((keyId: string) => revokeApiKeyAsync(keyId), [revokeApiKeyAsync]);

  const apiKeys: ApiKeyAdminPublic[] = adminKeysQuery.data?.data ?? [];
  const count = adminKeysQuery.data?.count ?? 0;
  const loading = adminKeysQuery.isLoading || adminKeysQuery.isFetching;

  return {
    apiKeys,
    count,
    loading,
    error: adminKeysQuery.error ?? null,
    reload,
    revoke,
    revokeMutation,
    isLoading: adminKeysQuery.isLoading,
    isFetching: adminKeysQuery.isFetching,
    refetch: adminKeysQuery.refetch
  };
}
