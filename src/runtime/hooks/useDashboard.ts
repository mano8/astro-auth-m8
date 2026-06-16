import { useCallback, useEffect, useState } from "react";
import { getGlobalActivity, getUserActivity } from "../api/dashboard.js";
import type { UsersActivity } from "../schemas.js";

export function useDashboard(scope: "me" | "global" = "me", load = true) {
  const [activity, setActivity] = useState<UsersActivity | null>(null);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = scope === "global" ? await getGlobalActivity() : await getUserActivity();
      setActivity(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (load) void reload().catch(() => undefined);
  }, [load, reload]);

  return { activity, loading, error, reload };
}
