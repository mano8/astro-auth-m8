import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { createUser, deleteUser, getUser, listUsers, signupUser, updateUser } from "../api/users.js";
import { refetchOrThrow } from "./queryHelpers.js";
import { emitAuthRevocation } from "../authEvents.js";
import { authKeys } from "../queryKeys.js";
import type { UserAuthorizationUpdate, UserCreate, UserRegister, UserUpdate, UsersPublic } from "../schemas.js";

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

      const staleKeys: QueryKey[] = [authKeys.users(), authKeys.user(variables.id)];
      // AA-11: `revocation_enqueued` reports that the target's sessions were
      // revoked and an authorization-generation bump is propagating, so every
      // cached view of that principal's privileges is stale - dropping it is
      // what stops a demoted user rendering privileged UI from cache. The
      // owner-scoped profile/session/key caches are invalidated too: this layer
      // cannot tell whether the target is the signed-in principal, and a
      // redundant refetch is strictly safer than a stale privileged view.
      if (updatedUser.revocation_enqueued) {
        staleKeys.push(
          authKeys.profile(),
          authKeys.sessions(),
          authKeys.apiKeys(),
          authKeys.adminApiKeys(variables.id)
        );
      }
      await Promise.all(staleKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

      // The provider holds the signed-in user in memory, outside this cache;
      // notify it so it re-reads the profile instead of waiting for the next
      // incidental `getProfile()`. It ignores every other user id.
      if (updatedUser.revocation_enqueued) emitAuthRevocation(variables.id);
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
  const update = useCallback((id: string, body: UserUpdate): Promise<UserAuthorizationUpdate> => updateUserAsync({ id, body }), [updateUserAsync]);
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
