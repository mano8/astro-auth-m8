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
  const { refetch } = profileQuery;
  const { mutateAsync: saveProfileAsync } = saveMutation;
  const { mutateAsync: changePasswordAsync } = changePasswordMutation;
  const { mutateAsync: removeProfileAsync } = removeMutation;

  const reload = useCallback(async () => {
    const result = await refetch({ throwOnError: true });
    return result.data ?? null;
  }, [refetch]);

  const save = useCallback((body: UserUpdateMe) => saveProfileAsync(body), [saveProfileAsync]);
  const changePassword = useCallback((body: UpdatePassword) => changePasswordAsync(body), [changePasswordAsync]);
  const remove = useCallback(() => removeProfileAsync(), [removeProfileAsync]);

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
