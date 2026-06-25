import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { createApiKey, listApiKeys, revokeApiKey } from "../api/apiKeys.js";
import { authKeys } from "../queryKeys.js";
import type { ApiKeyCreate, ApiKeyCreated, ApiKeyPublic } from "../schemas.js";

export function useApiKeys(load = true) {
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const apiKeysQuery = useQuery({
    queryKey: authKeys.apiKeys(),
    queryFn: listApiKeys,
    enabled: load,
    staleTime: 30_000
  });

  const reload = useCallback(async () => {
    const result = await apiKeysQuery.refetch({ throwOnError: true });
    return result.data ?? [];
  }, [apiKeysQuery]);

  const create = useCallback(async (body: ApiKeyCreate) => {
    const key = await createApiKey(body);
    setCreatedKey(key);
    await reload();
    return key;
  }, [reload]);

  const revoke = useCallback(async (id: string) => {
    const message = await revokeApiKey(id);
    await reload();
    return message;
  }, [reload]);

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
    isLoading: apiKeysQuery.isLoading,
    isFetching: apiKeysQuery.isFetching,
    refetch: apiKeysQuery.refetch
  };
}
