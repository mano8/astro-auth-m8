import { useCallback, useEffect, useState } from "react";
import { createApiKey, listApiKeys, revokeApiKey } from "../api/apiKeys.js";
import type { ApiKeyCreate, ApiKeyCreated, ApiKeyPublic } from "../schemas.js";

export function useApiKeys(load = true) {
  const [apiKeys, setApiKeys] = useState<ApiKeyPublic[]>([]);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await listApiKeys();
      setApiKeys(keys);
      setError(null);
      return keys;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (load) void reload().catch(() => undefined);
  }, [load, reload]);

  return { apiKeys, createdKey, loading, error, reload, create, revoke };
}
