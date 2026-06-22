"use client";

// fa-auth account view whose FIRST/landing tab is the activity dashboard.
// Headless auth state comes from the package (@fa-m8/astro-auth-m8/react); this
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
} from "@fa-m8/astro-auth-m8/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DashboardOverview,
  type DashboardOverviewLabels,
} from "@/components/fa-auth/dashboard-overview";

export interface AccountTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  /** Only render this tab when the signed-in user is a superuser. */
  superuserOnly?: boolean;
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md py-10 text-center text-sm text-muted-foreground">
        {signIn ?? labels.signInRequired}
      </div>
    );
  }

  const visibleTabs = extraTabs.filter(
    (tab) => !tab.superuserOnly || user.is_superuser,
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
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

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="size-4" />
            {labels.dashboardTab}
          </TabsTrigger>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                {Icon ? <Icon className="size-4" /> : null}
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardOverview scope={scope} labels={labels.dashboard} />
        </TabsContent>
        {visibleTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
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
