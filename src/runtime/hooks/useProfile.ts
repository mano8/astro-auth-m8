import { useCallback, useEffect, useState } from "react";
import { deleteProfile, getProfile, updatePassword, updateProfile } from "../api/profile.js";
import type { UpdatePassword, UserPublic, UserUpdateMe } from "../schemas.js";

export function useProfile(load = true) {
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await getProfile();
      setProfile(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (body: UserUpdateMe) => {
    const response = await updateProfile(body);
    setProfile(response.user);
    return response;
  }, []);

  const changePassword = useCallback((body: UpdatePassword) => updatePassword(body), []);
  const remove = useCallback(() => deleteProfile(), []);

  useEffect(() => {
    if (load) void reload().catch(() => undefined);
  }, [load, reload]);

  return { profile, loading, error, reload, save, changePassword, remove };
}
