import { useCallback, useEffect, useState } from "react";
import { createUser, deleteUser, getUser, listUsers, signupUser, updateUser } from "../api/users.js";
import type { UserCreate, UserRegister, UserUpdate, UsersPublic } from "../schemas.js";

export function useUsers(load = true) {
  const [users, setUsers] = useState<UsersPublic | null>(null);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await listUsers();
      setUsers(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback((body: UserCreate) => createUser(body), []);
  const signup = useCallback((body: UserRegister) => signupUser(body), []);
  const get = useCallback((id: string) => getUser(id), []);
  const update = useCallback((id: string, body: UserUpdate) => updateUser(id, body), []);
  const remove = useCallback((id: string) => deleteUser(id), []);

  useEffect(() => {
    if (load) void reload().catch(() => undefined);
  }, [load, reload]);

  return { users, loading, error, reload, create, signup, get, update, remove };
}
