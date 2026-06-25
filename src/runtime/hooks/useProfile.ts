import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (response) => {
      queryClient.setQueryData(authKeys.profile(), response.user);
      await queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    }
  });
  const changePasswordMutation = useMutation({ mutationFn: updatePassword });
  const removeMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profile() });
      queryClient.removeQueries({ queryKey: authKeys.profile(), exact: true });
    }
  });

  const save = useCallback((body: UserUpdateMe) => saveMutation.mutateAsync(body), [saveMutation]);
  const changePassword = useCallback((body: UpdatePassword) => changePasswordMutation.mutateAsync(body), [changePasswordMutation]);
  const remove = useCallback(() => removeMutation.mutateAsync(), [removeMutation]);

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
    saveMutation,
    changePasswordMutation,
    removeMutation,
    isLoading: profileQuery.isLoading,
    isFetching: profileQuery.isFetching,
    refetch: profileQuery.refetch
  };
}
