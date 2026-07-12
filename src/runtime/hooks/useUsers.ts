import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createUser, deleteUser, getUser, listUsers, signupUser, updateUser } from "../api/users.js";
import { refetchOrThrow } from "./queryHelpers.js";
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
  const { refetch } = usersQuery;
  const { mutateAsync: createUserAsync } = createMutation;
  const { mutateAsync: signupUserAsync } = signupMutation;
  const { mutateAsync: updateUserAsync } = updateMutation;
  const { mutateAsync: removeUserAsync } = removeMutation;

  const reload = useCallback(() => refetchOrThrow(refetch, null), [refetch]);

  const create = useCallback((body: UserCreate) => createUserAsync(body), [createUserAsync]);
  const signup = useCallback((body: UserRegister) => signupUserAsync(body), [signupUserAsync]);
  const get = useCallback((id: string) => queryClient.fetchQuery({
    queryKey: authKeys.user(id),
    queryFn: () => getUser(id),
    staleTime: 30_000
  }), [queryClient]);
  const update = useCallback((id: string, body: UserUpdate) => updateUserAsync({ id, body }), [updateUserAsync]);
  const remove = useCallback((id: string) => removeUserAsync(id), [removeUserAsync]);

  const users: UsersPublic | null = usersQuery.data ?? null;
  const loading = usersQuery.isLoading || usersQuery.isFetching;

  return {
    users,
    loading,
    error: usersQuery.error ?? null,
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
