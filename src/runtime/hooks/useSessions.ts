import { useCallback, useEffect, useState } from "react";
import { getCurrentSession, listSessions, revokeSession } from "../api/sessions.js";
import type { ClientSessionPublic, ClientSessionsPublic } from "../schemas.js";

export function useSessions(load = true) {
  const [sessions, setSessions] = useState<ClientSessionsPublic | null>(null);
  const [current, setCurrent] = useState<ClientSessionPublic | null>(null);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await listSessions();
      setSessions(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const value = await getCurrentSession();
      setCurrent(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const revoke = useCallback((id: string) => revokeSession(id), []);

  useEffect(() => {
    if (load) void reload().catch(() => undefined);
  }, [load, reload]);

  return { sessions, current, loading, error, reload, reloadCurrent, revoke };
}
