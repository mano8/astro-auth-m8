"use client";

// fa-auth sessions panel: current session details + your/all activity summaries,
// with superuser-only session revocation. Headless logic stays a live dependency
// — `useAuth` (@fa-m8/astro-auth-m8/react) supplies the user, `useSessions` and
// `useDashboard` (@fa-m8/astro-auth-m8/hooks) supply the data. This file is only
// the shadcn skin, copied into the consumer via the @fa-m8-auth registry — edit
// (and translate via `labels`) freely per app.
import * as React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@fa-m8/astro-auth-m8/react";
import { useSessions, useDashboard } from "@fa-m8/astro-auth-m8/hooks";
import type { UsersActivity } from "@fa-m8/astro-auth-m8/schemas";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface SessionsPanelLabels {
  notAvailable: string;
  logins: string;
  registrations: string;
  users: string;
  title: string;
  description: string;
  provider: string;
  jwtExpires: string;
  refreshExpires: string;
  notLoaded: string;
  yourActivity: string;
  refresh: string;
  adminTitle: string;
  adminDescription: string;
  allActivity: string;
  loading: string;
  empty: string;
  expires: string;
  revoke: string;
}

const DEFAULT_LABELS: SessionsPanelLabels = {
  notAvailable: "n/a",
  logins: "Logins",
  registrations: "Registrations",
  users: "Users",
  title: "Session",
  description: "Current authentication session and account activity.",
  provider: "Provider",
  jwtExpires: "JWT expires",
  refreshExpires: "Refresh expires",
  notLoaded: "Session details are not loaded.",
  yourActivity: "Your activity",
  refresh: "Refresh",
  adminTitle: "Admin sessions",
  adminDescription: "Superuser-only session overview.",
  allActivity: "All activity",
  loading: "Loading sessions...",
  empty: "No sessions returned.",
  expires: "Expires",
  revoke: "Revoke",
};

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ActivitySummary({
  title,
  totalLogins,
  totalRegistrations,
  totalUsers,
  t,
}: {
  title: string;
  totalLogins?: number;
  totalRegistrations?: number;
  totalUsers?: number;
  t: SessionsPanelLabels;
}) {
  return (
    <div className="rounded-md border p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t.logins}</dt>
          <dd className="font-medium">{totalLogins ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.registrations}</dt>
          <dd className="font-medium">{totalRegistrations ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.users}</dt>
          <dd className="font-medium">{totalUsers ?? "-"}</dd>
        </div>
      </dl>
    </div>
  );
}

function activityAdded(stats: UsersActivity | null, model: string): number | undefined {
  return stats?.activity.activity.find((entry) => entry.model === model)?.added;
}

export function SessionsPanel({ labels }: { labels?: Partial<SessionsPanelLabels> }) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;

  const { current, reloadCurrent, sessions, reload: list, revoke, loading } = useSessions(false);
  const { activity: mine, reload: reloadMine } = useDashboard("me", false);
  const { activity: all, reload: reloadAll } = useDashboard("global", false);

  const rows = sessions?.data ?? [];

  React.useEffect(() => {
    reloadCurrent().catch(() => {});
    reloadMine().catch(() => {});
  }, [reloadCurrent, reloadMine]);

  React.useEffect(() => {
    if (!isSuperuser) return;
    list().catch(() => {});
    reloadAll().catch(() => {});
  }, [isSuperuser, list, reloadAll]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {current ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t.provider}</dt>
                <dd className="font-medium">{current.provider}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t.jwtExpires}</dt>
                <dd className="font-medium text-right">{formatDate(current.jwt_expires_at, t.notAvailable)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t.refreshExpires}</dt>
                <dd className="font-medium text-right">{formatDate(current.refresh_expires_at, t.notAvailable)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t.notLoaded}</p>
          )}

          <ActivitySummary
            title={t.yourActivity}
            totalLogins={activityAdded(mine, "login")}
            totalRegistrations={activityAdded(mine, "registration")}
            totalUsers={mine?.nb_users}
            t={t}
          />

          <Button type="button" variant="outline" onClick={() => { reloadCurrent(); reloadMine(); }}>
            <RefreshCw />
            {t.refresh}
          </Button>
        </CardContent>
      </Card>

      {isSuperuser && (
        <Card>
          <CardHeader>
            <CardTitle>{t.adminTitle}</CardTitle>
            <CardDescription>{t.adminDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActivitySummary
              title={t.allActivity}
              totalLogins={activityAdded(all, "login")}
              totalRegistrations={activityAdded(all, "registration")}
              totalUsers={all?.nb_users}
              t={t}
            />

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {loading ? t.loading : t.empty}
              </p>
            ) : (
              <div className="divide-y rounded-md border">
                {rows.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{session.id}</p>
                      <p className="text-muted-foreground">{t.expires} {formatDate(session.refresh_expires_at, t.notAvailable)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        await revoke(session.id);
                        await list();
                      }}
                    >
                      <Trash2 />
                      {t.revoke}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
