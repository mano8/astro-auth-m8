import type { ReactNode } from "react";
import { useProfile } from "../../hooks/useProfile.js";
import { useAuth } from "../AuthProvider.js";

function AccountPanelMessage({ children, role }: { children: ReactNode; role?: "alert" | "status" }) {
  return (
    <section className="not-content fa-auth-panel">
      <p role={role}>{children}</p>
    </section>
  );
}

export function AccountView() {
  const { user, logout } = useAuth();
  const { profile, loading, error } = useProfile(!user);
  const value = user ?? profile;

  if (loading) return <AccountPanelMessage role="status">Loading account</AccountPanelMessage>;
  if (error) return <AccountPanelMessage role="alert">Unable to load account</AccountPanelMessage>;
  if (!value) return <AccountPanelMessage>Please sign in to view your account.</AccountPanelMessage>;

  return (
    <section className="not-content fa-auth-panel">
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
