import { useCallback, useState } from "react";
import { createPkcePair, getGoogleLoginUrl, savePkceVerifier } from "../api/oauth.js";

export function useGoogleLogin(redirectUri: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const { verifier, challenge } = await createPkcePair();
      savePkceVerifier(verifier);
      const { url } = await getGoogleLoginUrl({ redirect_target: redirectUri, code_challenge: challenge });
      window.location.assign(url);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [redirectUri]);

  return { start, loading, error };
}
