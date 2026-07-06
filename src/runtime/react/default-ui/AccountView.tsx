import type { ReactNode } from "react";
import { useProfile } from "../../hooks/useProfile.js";
import { useAuth } from "../AuthProvider.js";

const panelClassName =
  "not-content fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90";

function AccountPanelMessage({ children, role }: { children: ReactNode; role?: "alert" | "status" }) {
  return (
    <section className={panelClassName}>
      <p className={role === "alert" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role={role}>{children}</p>
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
    <section className={panelClassName}>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Account</h1>
        <p className="text-sm text-muted-foreground">Your current auth profile and access level.</p>
      </div>
      <dl className="grid gap-3 text-sm">
        <div className="grid gap-1">
          <dt className="font-medium text-muted-foreground">Email</dt>
          <dd>{value.email}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="font-medium text-muted-foreground">Name</dt>
          <dd>{value.full_name ?? "Not set"}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="font-medium text-muted-foreground">Role</dt>
          <dd className="capitalize">{value.role}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        onClick={() => void logout()}
      >
        Sign out
      </button>
    </section>
  );
}
