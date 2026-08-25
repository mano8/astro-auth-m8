"use client";

// fa-auth account view whose FIRST/landing tab is the activity dashboard.
// Headless auth state comes from the package (@mano8/astro-auth-m8/react); this
// file is only the shadcn skin and is copied into the consumer via the
// @fa-m8-auth registry. Secondary tabs (profile/sessions/api-keys/admin) are
// passed in by the consumer via `extraTabs`, so locale + app-specific panels
// stay owned by the app. Edit freely per app.
import * as React from "react";
import { LayoutDashboard, LogOut } from "lucide-react";
import {
  AuthProvider,
  useAuth,
  type AuthContextValue,
} from "@mano8/astro-auth-m8/react";
import {
  hasMinimumRole,
  hasSuperuserPrivileges,
} from "@mano8/astro-auth-m8/authorization";
import type { RoleType } from "@mano8/astro-auth-m8/schemas";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  DashboardOverview,
  type DashboardOverviewLabels,
} from "@/components/fa-auth/dashboard-overview";
import { cn } from "@/lib/utils";

export interface AccountTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  /** Only render this tab when the signed-in user is a superuser. */
  superuserOnly?: boolean;
  /**
   * Only render this tab when the signed-in user holds at least this role.
   * Uses the ordered hierarchy, so `minRole: "admin"` also admits a superadmin.
   * This is the admin tier: `fa-auth-m8` 2.0.0 authorizes the audit-log read
   * from the role hierarchy alone, so gating it with `superuserOnly` would hide
   * an admin's own surface from them.
   */
  minRole?: RoleType;
}

export interface AccountDashboardLabels {
  dashboardTab: string;
  signOut: string;
  signInRequired: string;
  dashboard: Partial<DashboardOverviewLabels>;
}

const DEFAULT_LABELS: AccountDashboardLabels = {
  dashboardTab: "Dashboard",
  signOut: "Sign out",
  signInRequired: "Please sign in to view your account.",
  dashboard: {},
};

export interface AccountDashboardProps {
  /** Auth API base path; defaults to PUBLIC_FA_AUTH_API_BASE or "/user". */
  apiBase?: string;
  /** Dashboard scope: "me" (default) or "global" for superuser fleet stats. */
  scope?: "me" | "global";
  extraTabs?: AccountTab[];
  labels?: Partial<AccountDashboardLabels>;
  /** Rendered when the user is not authenticated. */
  signIn?: React.ReactNode;
}

function AccountShell({
  scope,
  extraTabs,
  labels,
  signIn,
}: Required<Pick<AccountDashboardProps, "scope" | "extraTabs">> & {
  labels: AccountDashboardLabels;
  signIn?: React.ReactNode;
}) {
  const { user, loading, logout }: AuthContextValue = useAuth();
  // Declared before the loading and signed-out early returns: this component
  // renders those branches first and the signed-in branch afterwards, so a hook
  // placed below them changes hook order between renders and React throws.
  const [activeTab, setActiveTab] = React.useState<string>("dashboard");

  if (loading) {
    return (
      <div className="not-content mx-auto w-full max-w-6xl space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="not-content mx-auto w-full max-w-md py-10 text-center text-sm text-muted-foreground">
        {signIn ?? labels.signInRequired}
      </div>
    );
  }

  // Two deliberately different predicates: `superuserOnly` needs dual evidence
  // (role + is_superuser), `minRole` is the role hierarchy alone - the same
  // split the backend makes between its superuser and admin dependencies.
  // Each is only a display gate; every panel still self-gates and the service
  // stays the authority.
  const visibleTabs = extraTabs.filter(
    (tab) =>
      (!tab.superuserOnly ||
        hasSuperuserPrivileges(user.role, user.is_superuser)) &&
      (!tab.minRole || hasMinimumRole(user.role, tab.minRole)),
  );
  const navItems = [
    {
      id: "dashboard",
      label: labels.dashboardTab,
      icon: LayoutDashboard,
      content: <DashboardOverview scope={scope} labels={labels.dashboard} />,
    },
    ...visibleTabs,
  ];
  const columnClass = navItems.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";

  return (
    <div className="not-content mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {user.email}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-md border px-2 py-0.5 text-xs uppercase tracking-wide">
              {user.role}
            </span>
            {user.is_superuser ? (
              <span className="rounded-md border px-2 py-0.5 text-xs uppercase tracking-wide">
                superuser
              </span>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void logout()}
          className="w-full justify-center gap-2 sm:w-auto"
        >
          <LogOut className="size-4" />
          {labels.signOut}
        </Button>
      </div>

      <div className="space-y-4">
        <NavigationMenu viewport={false} className="w-full max-w-none justify-stretch">
          <NavigationMenuList
            className={cn(
              "grid h-auto w-full grid-cols-1 items-stretch justify-stretch rounded-lg border border-border bg-muted/40 p-1 sm:grid-cols-2",
              columnClass,
            )}
          >
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <NavigationMenuItem key={tab.id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs"
                  data-active={active}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  <span className="truncate">{tab.label}</span>
                </button>
              </NavigationMenuItem>
            );
          })}
          </NavigationMenuList>
        </NavigationMenu>

        {navItems.map((tab) =>
          activeTab === tab.id ? <React.Fragment key={tab.id}>{tab.content}</React.Fragment> : null,
        )}
      </div>
    </div>
  );
}

export default function AccountDashboard({
  apiBase,
  scope = "me",
  extraTabs = [],
  labels,
  signIn,
}: AccountDashboardProps) {
  const resolved: AccountDashboardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    dashboard: { ...DEFAULT_LABELS.dashboard, ...labels?.dashboard },
  };
  const config = apiBase ? { apiBase } : undefined;
  return (
    <AuthProvider config={config}>
      <AccountShell
        scope={scope}
        extraTabs={extraTabs}
        labels={resolved}
        signIn={signIn}
      />
    </AuthProvider>
  );
}
