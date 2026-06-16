import { useState, type FormEvent } from "react";
import { useAuth } from "../AuthProvider.js";

export function LoginView({ signupHref, googleEnabled = false, onGoogle }: { signupHref?: string; googleEnabled?: boolean; onGoogle?: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      window.location.assign("../user/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fa-auth-panel">
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
        </label>
        <label>
          Password
          <input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={busy} type="submit">{busy ? "Signing in" : "Sign in"}</button>
      </form>
      {googleEnabled ? <button type="button" onClick={onGoogle}>Continue with Google</button> : null}
      {signupHref ? <p><a href={signupHref}>Create an account</a></p> : null}
    </section>
  );
}
