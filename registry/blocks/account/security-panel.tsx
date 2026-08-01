"use client";

// fa-auth security panel: the admin-tier privileged-action audit log plus the
// two superadmin-only retention purges. Headless logic stays a live dependency
// — `useAuditLog` / `useSecurityPurges` (@mano8/astro-auth-m8/hooks) own the
// calls and the package Zod schemas own the closed retention-window enum. This
// file is only the shadcn skin, copied into the consumer via the @fa-m8-auth
// registry — edit (and translate via `labels`) freely per app.
//
// Two tiers, two deliberately different gates, mirroring fa-auth-m8 2.0.0:
//   * the audit-log READ is authorized by the role hierarchy alone
//     (`get_current_active_admin`), so it is gated with `RequireRole
//     roles={["admin"]}` — gating it on superuser would hide an admin's own
//     surface from them;
//   * both PURGES are superuser actions (`get_current_active_superuser`), so
//     they are gated with `RequireRole superuser` (dual evidence).
// Which rows the log returns — an admin's own, or every row for a superadmin —
// is decided server-side from the authenticated principal. This panel renders
// what it receives and never sends an actor id to widen or narrow that.
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { RotateCcw, Trash2 } from "lucide-react";
import { RequireRole } from "@mano8/astro-auth-m8/react";
import { useAuditLog, useSecurityPurges } from "@mano8/astro-auth-m8/hooks";
import { ApiError } from "@mano8/astro-auth-m8/errors";
import {
  RetentionWindowSchema,
  type PrivilegedActionAuditPublic,
  type PurgeResponse,
  type RetentionWindow,
} from "@mano8/astro-auth-m8/schemas";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/m8-ui/data-table";
import { DataTableColumnHeader } from "@/components/m8-ui/data-table-column-header";
import {
  AccountToastHost,
  accountToast,
  ConfirmDeleteDialog,
  errorMessage,
  useClientTable,
} from "./account-crud";

export interface SecurityPanelLabels {
  auditTitle: string;
  auditDescription: string;
  auditScopeNotice: string;
  adminRequired: string;
  refresh: string;
  loading: string;
  empty: string;
  search: string;
  when: string;
  action: string;
  actor: string;
  actorRole: string;
  table: string;
  row: string;
  targetOwner: string;
  notAvailable: string;
  auditLoadFailed: string;
  purgeTitle: string;
  purgeDescription: string;
  retentionFloorNotice: string;
  window: string;
  windowLabels: Record<RetentionWindow, string>;
  purgeAuditTitle: string;
  purgeAuditDescription: string;
  purgeAuditConfirmTitle: string;
  purgeAuditConfirmBody: string;
  purgeKeysTitle: string;
  purgeKeysDescription: string;
  purgeKeysConfirmTitle: string;
  purgeKeysConfirmBody: string;
  purge: string;
  purging: string;
  cancel: string;
  purged: string;
  purgedRemoved: string;
  purgeFailed: string;
  unknownOutcomeTitle: string;
  unknownOutcomeBody: string;
  unknownOutcomeAcknowledge: string;
}

const DEFAULT_LABELS: SecurityPanelLabels = {
  auditTitle: "Privileged action audit log",
  auditDescription:
    "Every privileged write recorded by the auth service, newest first.",
  auditScopeNotice:
    "Scope is decided by the auth service from your own credentials: an admin sees the entries it authored, a superadmin sees every entry. This view never requests another user's entries.",
  adminRequired: "The audit log is available to admin accounts and above.",
  refresh: "Refresh",
  loading: "Loading audit entries...",
  empty: "No audit entries found.",
  search: "Search entries",
  when: "When",
  action: "Action",
  actor: "Actor",
  actorRole: "Actor role",
  table: "Table",
  row: "Row",
  targetOwner: "Target owner",
  notAvailable: "n/a",
  auditLoadFailed: "Failed to load the audit log.",
  purgeTitle: "Retention purges",
  purgeDescription:
    "Superuser-only maintenance: permanently delete records older than the selected retention window.",
  retentionFloorNotice:
    "The auth service enforces a minimum retention floor. It is server-side configuration and is not published by any endpoint, so a window shorter than the floor cannot be caught here - the service rejects it and its reason is shown verbatim.",
  window: "Retention window",
  windowLabels: {
    "1w": "Older than 1 week",
    "1m": "Older than 1 month",
    "3m": "Older than 3 months",
    "6m": "Older than 6 months",
    "1y": "Older than 1 year",
  },
  purgeAuditTitle: "Purge audit entries",
  purgeAuditDescription:
    "Deletes privileged-action audit entries older than the selected window.",
  purgeAuditConfirmTitle: "Purge audit entries?",
  purgeAuditConfirmBody:
    "This permanently deletes every audit entry older than the selected retention window. Audit history cannot be restored, and entries below the service's retention floor are refused.",
  purgeKeysTitle: "Purge revoked API keys",
  purgeKeysDescription:
    "Deletes revoked or expired API key records older than the selected window.",
  purgeKeysConfirmTitle: "Purge API key records?",
  purgeKeysConfirmBody:
    "This permanently deletes revoked and expired API key records older than the selected retention window. The records cannot be restored, and windows below the service's retention floor are refused.",
  purge: "Purge",
  purging: "Purging...",
  cancel: "Cancel",
  purged: "Purge complete.",
  purgedRemoved: "Records removed",
  purgeFailed: "Purge failed.",
  unknownOutcomeTitle: "Outcome unknown",
  unknownOutcomeBody:
    "The auth service could not confirm whether this purge ran. Check the current record counts before doing anything else - re-running it now could delete more than you intend, and the reported count would be wrong either way.",
  unknownOutcomeAcknowledge: "I have checked - re-enable",
};

function formatDate(value: string | null | undefined, fallback: string): string {
  return value ? new Date(value).toLocaleString() : fallback;
}

function AuditLogSection({ t }: { t: SecurityPanelLabels }) {
  // No actor filter is sent: the service scopes the rows from the caller's own
  // credentials, and passing one here could only ever ask for someone else's.
  const { rows, count, loading, reload } = useAuditLog({}, false);

  React.useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const controller = useClientTable(rows, {
    search: (entry) => `${entry.action} ${entry.table_name} ${entry.actor_user_id}`,
    sorters: {
      created_at: (entry) => entry.created_at,
      action: (entry) => entry.action,
      actor_role: (entry) => entry.actor_role,
      table_name: (entry) => entry.table_name,
    },
    initialSortBy: "created_at",
    initialSortDir: "desc",
  });

  const columns = React.useMemo<ColumnDef<PrivilegedActionAuditPublic>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.when} />
        ),
        cell: ({ row }) => formatDate(row.original.created_at, t.notAvailable),
      },
      {
        accessorKey: "action",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.action} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.action}
          </Badge>
        ),
      },
      {
        accessorKey: "table_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.table} />
        ),
      },
      {
        accessorKey: "row_pk",
        header: t.row,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.row_pk}</span>
        ),
      },
      {
        accessorKey: "actor_role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.actorRole} />
        ),
        cell: ({ row }) => (
          <span className="capitalize">{row.original.actor_role}</span>
        ),
      },
      {
        accessorKey: "actor_user_id",
        header: t.actor,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.actor_user_id}</span>
        ),
      },
      {
        accessorKey: "target_owner_id",
        header: t.targetOwner,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.target_owner_id ?? t.notAvailable}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auditTitle}</CardTitle>
        <CardDescription>{t.auditDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.auditScopeNotice}</p>
        <DataTable<PrivilegedActionAuditPublic, unknown>
          columns={columns}
          data={controller.data}
          rowCount={controller.rowCount}
          page={controller.page}
          pageSize={controller.pageSize}
          onPageChange={controller.onPageChange}
          onPageSizeChange={controller.onPageSizeChange}
          sortBy={controller.sortBy}
          sortDir={controller.sortDir}
          onSortChange={controller.onSortChange}
          q={controller.q}
          onSearchChange={controller.onSearchChange}
          loading={loading && count === 0}
          getRowId={(entry) => entry.id}
          labels={{
            loading: t.loading,
            empty: t.empty,
            toolbar: { search: t.search },
          }}
          addButton={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                reload().catch((error) => {
                  accountToast.error(errorMessage(error, t.auditLoadFailed));
                });
              }}
            >
              <RotateCcw className="size-4" />
              {t.refresh}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

function PurgeCard({
  t,
  title,
  description,
  confirmTitle,
  confirmBody,
  action,
  testId,
}: {
  t: SecurityPanelLabels;
  title: string;
  description: string;
  confirmTitle: string;
  confirmBody: string;
  action: (retention: RetentionWindow) => Promise<PurgeResponse>;
  testId: string;
}) {
  const [retention, setRetention] = React.useState<RetentionWindow>("1y");
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Set on a 503 only. The purge may or may not have run, so the control is
  // locked until the operator explicitly acknowledges having checked: a purge
  // is not idempotent in its reporting, and a blind re-run would both delete
  // more than intended and report a count the operator would misread.
  const [outcomeUnknown, setOutcomeUnknown] = React.useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      const result = await action(retention);
      setConfirming(false);
      accountToast.success({
        title: t.purged,
        description: `${t.purgedRemoved}: ${result.removed}`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setOutcomeUnknown(true);
        setConfirming(false);
      }
      // 429 (rate limited, not attempted), 503 (unknown) and the free-text 400
      // retention-floor rejection are all mapped by the package's
      // describeApiError; nothing is retried automatically here.
      accountToast.error(errorMessage(error, t.purgeFailed));
    } finally {
      setPending(false);
    }
  };

  const selectId = `${testId}-window`;

  return (
    <Card className="h-full" data-account-purge={testId}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={selectId}>{t.window}</Label>
          {/* Closed enum, never free text or a date: the service accepts only
              these five windows, and the list is derived from the package
              schema so it cannot drift from the contract. */}
          <select
            id={selectId}
            aria-label={t.window}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={retention}
            onChange={(event) =>
              setRetention(event.target.value as RetentionWindow)
            }
          >
            {RetentionWindowSchema.options.map((option) => (
              <option key={option} value={option}>
                {t.windowLabels[option]}
              </option>
            ))}
          </select>
        </div>

        {outcomeUnknown ? (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm"
          >
            <p className="font-medium">{t.unknownOutcomeTitle}</p>
            <p className="text-muted-foreground">{t.unknownOutcomeBody}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOutcomeUnknown(false)}
              data-account-action="acknowledge-unknown"
            >
              {t.unknownOutcomeAcknowledge}
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || outcomeUnknown}
          onClick={() => setConfirming(true)}
          data-account-action="purge"
        >
          <Trash2 className="size-3.5" />
          {pending ? t.purging : t.purge}
        </Button>
      </CardContent>

      {/* Purges are never a one-click action: each goes through its own
          confirmation naming what is deleted and that a window below the
          service's retention floor is refused. */}
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        title={confirmTitle}
        description={`${confirmBody} ${t.retentionFloorNotice}`}
        confirmLabel={t.purge}
        cancelLabel={t.cancel}
        pending={pending}
        onConfirm={() => {
          void confirm();
        }}
      />
    </Card>
  );
}

function PurgeSection({ t }: { t: SecurityPanelLabels }) {
  const { purgeAudit, purgeKeys } = useSecurityPurges();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.purgeTitle}</CardTitle>
        <CardDescription>{t.purgeDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.retentionFloorNotice}</p>
        <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
          <PurgeCard
            t={t}
            testId="audit-log"
            title={t.purgeAuditTitle}
            description={t.purgeAuditDescription}
            confirmTitle={t.purgeAuditConfirmTitle}
            confirmBody={t.purgeAuditConfirmBody}
            action={purgeAudit}
          />
          <PurgeCard
            t={t}
            testId="api-keys"
            title={t.purgeKeysTitle}
            description={t.purgeKeysDescription}
            confirmTitle={t.purgeKeysConfirmTitle}
            confirmBody={t.purgeKeysConfirmBody}
            action={purgeKeys}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityPanel({
  labels,
}: {
  labels?: Partial<SecurityPanelLabels>;
}) {
  const t = {
    ...DEFAULT_LABELS,
    ...labels,
    windowLabels: { ...DEFAULT_LABELS.windowLabels, ...labels?.windowLabels },
  };

  return (
    <div className="not-content flex w-full flex-col gap-6">
      <AccountToastHost />
      {/* Admin tier: role hierarchy only, so a superadmin is admitted too. */}
      <RequireRole
        roles={["admin"]}
        fallback={
          <p className="text-sm text-muted-foreground">{t.adminRequired}</p>
        }
      >
        <AuditLogSection t={t} />
      </RequireRole>
      {/* Superadmin tier: dual evidence. Rendering nothing (not a message) for
          everyone else keeps the maintenance surface out of an admin's view. */}
      <RequireRole superuser>
        <PurgeSection t={t} />
      </RequireRole>
    </div>
  );
}
