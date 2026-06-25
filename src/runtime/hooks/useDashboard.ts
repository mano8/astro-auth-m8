import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { getGlobalActivity, getUserActivity } from "../api/dashboard.js";
import { authKeys } from "../queryKeys.js";
import type { UsersActivity } from "../schemas.js";

export function useDashboard(scope: "me" | "global" = "me", load = true) {
  const activityQuery = useQuery({
    queryKey: authKeys.dashboard(scope),
    queryFn: () => scope === "global" ? getGlobalActivity() : getUserActivity(),
    enabled: load,
    staleTime: 30_000
  });

  const reload = useCallback(async () => {
    const result = await activityQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [activityQuery]);

  const activity: UsersActivity | null = activityQuery.data ?? null;
  const loading = activityQuery.isLoading || activityQuery.isFetching;

  return {
    activity,
    loading,
    error: activityQuery.error,
    reload,
    isLoading: activityQuery.isLoading,
    isFetching: activityQuery.isFetching,
    refetch: activityQuery.refetch
  };
}
