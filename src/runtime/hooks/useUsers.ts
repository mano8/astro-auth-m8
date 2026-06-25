import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createUser, deleteUser, getUser, listUsers, signupUser, updateUser } from "../api/users.js";
import { authKeys } from "../queryKeys.js";
import type { UserCreate, UserRegister, UserUpdate, UsersPublic } from "../schemas.js";

export function useUsers(load = true) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: authKeys.users(),
    queryFn: () => listUsers(),
    enabled: load,
    staleTime: 30_000
  });

  const reload = useCallback(async () => {
    const result = await usersQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [usersQuery]);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async (createdUser) => {
      queryClient.setQueryData(authKeys.user(createdUser.id), createdUser);
      await queryClient.invalidateQueries({ queryKey: authKeys.users() });
    }
  });
  const signupMutation = useMutation({
    mutationFn: signupUser,
    onSuccess: async (createdUser) => {
      queryClient.setQueryData(authKeys.user(createdUser.id), createdUser);
      await queryClient.invalidateQueries({ queryKey: authKeys.users() });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdate }) => updateUser(id, body),
    onSuccess: async (updatedUser, variables) => {
      queryClient.setQueryData(authKeys.user(variables.id), updatedUser);
      queryClient.setQueryData(authKeys.user(updatedUser.id), updatedUser);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authKeys.users() }),
        queryClient.invalidateQueries({ queryKey: authKeys.user(variables.id) })
      ]);
    }
  });
  const removeMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async (_message, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authKeys.users() }),
        queryClient.invalidateQueries({ queryKey: authKeys.user(id) })
      ]);
      queryClient.removeQueries({ queryKey: authKeys.user(id), exact: true });
    }
  });

  const create = useCallback((body: UserCreate) => createMutation.mutateAsync(body), [createMutation]);
  const signup = useCallback((body: UserRegister) => signupMutation.mutateAsync(body), [signupMutation]);
  const get = useCallback((id: string) => queryClient.fetchQuery({
    queryKey: authKeys.user(id),
    queryFn: () => getUser(id),
    staleTime: 30_000
  }), [queryClient]);
  const update = useCallback((id: string, body: UserUpdate) => updateMutation.mutateAsync({ id, body }), [updateMutation]);
  const remove = useCallback((id: string) => removeMutation.mutateAsync(id), [removeMutation]);

  const users: UsersPublic | null = usersQuery.data ?? null;
  const loading = usersQuery.isLoading || usersQuery.isFetching;

  return {
    users,
    loading,
    error: usersQuery.error,
    reload,
    create,
    signup,
    get,
    update,
    remove,
    createMutation,
    signupMutation,
    updateMutation,
    removeMutation,
    isLoading: usersQuery.isLoading,
    isFetching: usersQuery.isFetching,
    refetch: usersQuery.refetch
  };
}
