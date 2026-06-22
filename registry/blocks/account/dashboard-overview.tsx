"use client";

// fa-auth account landing view: an activity dashboard built from the package's
// headless `useDashboard` hook. Logic stays a live dependency
// (@fa-m8/astro-auth-m8/hooks); this file is only the shadcn skin and is copied
// into the consumer via the @fa-m8-auth registry — edit freely per app.
import * as React from "react";
import { Activity, TrendingUp, Users } from "lucide-react";
import { useDashboard } from "@fa-m8/astro-auth-m8/hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityBarChart } from "@/components/fa-auth/activity-bar-chart";

export interface DashboardOverviewLabels {
  title: string;
  subtitle: string;
  users: string;
  totalAdded: string;
  totalUpdated: string;
  activityTitle: string;
  added: string;
  updated: string;
  empty: string;
  error: string;
}

const DEFAULT_LABELS: DashboardOverviewLabels = {
  title: "Overview",
  subtitle: "Account activity at a glance.",
  users: "Users",
  totalAdded: "Total added",
  totalUpdated: "Total updated",
  activityTitle: "Activity by model",
  added: "Added",
  updated: "Updated",
  empty: "No activity recorded yet.",
  error: "Could not load dashboard activity.",
};

/** Scope: "me" for the signed-in user, "global" for superuser fleet-wide stats. */
export interface DashboardOverviewProps {
  scope?: "me" | "global";
  labels?: Partial<DashboardOverviewLabels>;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardOverview({
  scope = "me",
  labels,
}: DashboardOverviewProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { activity, loading, error } = useDashboard(scope);

  const counters = activity?.activity.activity ?? [];
  const totals = counters.reduce(
    (acc, row) => ({
      added: acc.added + row.added,
      updated: acc.updated + row.updated,
    }),
    { added: 0, updated: 0 },
  );

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card role="alert" className="border-destructive/50">
        <CardContent className="py-6 text-sm text-destructive">
          {t.error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t.users}
          value={(activity?.nb_users ?? 0).toLocaleString()}
          icon={Users}
        />
        <StatCard
          label={t.totalAdded}
          value={totals.added.toLocaleString()}
          icon={TrendingUp}
        />
        <StatCard
          label={t.totalUpdated}
          value={totals.updated.toLocaleString()}
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {counters.length ? (
            <ActivityBarChart
              data={counters}
              addedLabel={t.added}
              updatedLabel={t.updated}
              className="aspect-auto h-64 w-full"
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.empty}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
