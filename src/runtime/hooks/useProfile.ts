import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { deleteProfile, getProfile, updatePassword, updateProfile } from "../api/profile.js";
import { authKeys } from "../queryKeys.js";
import type { UpdatePassword, UserPublic, UserUpdateMe } from "../schemas.js";

export function useProfile(load = true) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: authKeys.profile(),
    queryFn: getProfile,
    enabled: load,
    staleTime: 30_000
  });

  const reload = useCallback(async () => {
    const result = await profileQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [profileQuery]);

  const save = useCallback(async (body: UserUpdateMe) => {
    const response = await updateProfile(body);
    queryClient.setQueryData(authKeys.profile(), response.user);
    return response;
  }, [queryClient]);

  const changePassword = useCallback((body: UpdatePassword) => updatePassword(body), []);
  const remove = useCallback(() => deleteProfile(), []);

  const profile: UserPublic | null = profileQuery.data ?? null;
  const loading = profileQuery.isLoading || profileQuery.isFetching;

  return {
    profile,
    loading,
    error: profileQuery.error,
    reload,
    save,
    changePassword,
    remove,
    isLoading: profileQuery.isLoading,
    isFetching: profileQuery.isFetching,
    refetch: profileQuery.refetch
  };
}
