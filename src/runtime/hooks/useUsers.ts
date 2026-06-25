import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const create = useCallback((body: UserCreate) => createUser(body), []);
  const signup = useCallback((body: UserRegister) => signupUser(body), []);
  const get = useCallback((id: string) => queryClient.fetchQuery({
    queryKey: authKeys.user(id),
    queryFn: () => getUser(id),
    staleTime: 30_000
  }), [queryClient]);
  const update = useCallback((id: string, body: UserUpdate) => updateUser(id, body), []);
  const remove = useCallback((id: string) => deleteUser(id), []);

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
    isLoading: usersQuery.isLoading,
    isFetching: usersQuery.isFetching,
    refetch: usersQuery.refetch
  };
}
