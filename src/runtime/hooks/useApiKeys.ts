import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { createApiKey, listApiKeys, revokeApiKey } from "../api/apiKeys.js";
import { authKeys } from "../queryKeys.js";
import type { ApiKeyCreate, ApiKeyCreated, ApiKeyPublic } from "../schemas.js";

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

  const reload = useCallback(async () => {
    const result = await refetch({ throwOnError: true });
    return result.data ?? [];
  }, [refetch]);

  const create = useCallback((body: ApiKeyCreate) => createApiKeyAsync(body), [createApiKeyAsync]);
  const revoke = useCallback((id: string) => revokeApiKeyAsync(id), [revokeApiKeyAsync]);

  const apiKeys: ApiKeyPublic[] = apiKeysQuery.data ?? [];
  const loading = apiKeysQuery.isLoading || apiKeysQuery.isFetching;

  return {
    apiKeys,
    createdKey,
    loading,
    error: apiKeysQuery.error,
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
