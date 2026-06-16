import { useProfile } from "../../hooks/useProfile.js";
import { useAuth } from "../AuthProvider.js";

export function AccountView() {
  const { user, logout } = useAuth();
  const { profile, loading, error } = useProfile(!user);
  const value = user ?? profile;

  if (loading) return <p>Loading account</p>;
  if (error) return <p role="alert">Unable to load account</p>;
  if (!value) return <p>Please sign in to view your account.</p>;

  return (
    <section className="fa-auth-panel">
      <h1>Account</h1>
      <dl>
        <dt>Email</dt>
        <dd>{value.email}</dd>
        <dt>Name</dt>
        <dd>{value.full_name ?? "Not set"}</dd>
        <dt>Role</dt>
        <dd>{value.role}</dd>
      </dl>
      <button type="button" onClick={() => void logout()}>Sign out</button>
    </section>
  );
}
