"use client";

// fa-auth API keys panel: mint and revoke programmatic API tokens. Headless
// logic stays a live dependency — `useApiKeys` (@mano8/astro-auth-m8/hooks) owns
// the list/create/revoke calls and the package Zod schema validates the form.
// This file is only the shadcn skin, copied into the consumer via the
// @fa-m8-auth registry — edit (and translate via `labels`) freely per app.
import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { KeyRound, Trash2 } from "lucide-react";
import { useApiKeys } from "@mano8/astro-auth-m8/hooks";
import {
  ApiKeyCreateSchema,
  type ApiKeyPublic,
} from "@mano8/astro-auth-m8/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  createDataTableSelectionColumn,
} from "@/components/m8-ui/data-table";
import { DataTableColumnHeader } from "@/components/m8-ui/data-table-column-header";
import {
  AccountToastHost,
  accountToast,
  ConfirmDeleteDialog,
  EntityFormDialog,
  errorMessage,
  useClientTable,
} from "./account-crud";

export interface ApiKeysPanelLabels {
  title: string;
  description: string;
  createTitle: string;
  createDescription: string;
  name: string;
  namePlaceholder: string;
  ttl: string;
  ttlUnit: string;
  unitHours: string;
  unitDays: string;
  unitWeeks: string;
  defaultName: string;
  generating: string;
  mint: string;
  cancel: string;
  securityNotice: string;
  revealTitle: string;
  copied: string;
  copy: string;
  done: string;
  activeTitle: string;
  loading: string;
  empty: string;
  active: string;
  revoked: string;
  status: string;
  expires: string;
  lastUsed: string;
  notUsed: string;
  notAvailable: string;
  revoke: string;
  revokeSelected: string;
  confirmRevokeTitle: string;
  confirmRevokeBody: string;
  actions: string;
  search: string;
  created: string;
  createFailed: string;
  revokedOk: string;
  revokeFailed: string;
}

const DEFAULT_LABELS: ApiKeysPanelLabels = {
  title: "API keys",
  description: "Provision and revoke programmatic client identifiers.",
  createTitle: "Create API token",
  createDescription:
    "Provision programmatic client identifiers for remote integrations.",
  name: "Token name",
  namePlaceholder: "e.g. CI/CD deployment server",
  ttl: "Validity",
  ttlUnit: "Unit",
  unitHours: "Hours",
  unitDays: "Days",
  unitWeeks: "Weeks",
  defaultName: "Default key",
  generating: "Generating...",
  mint: "Mint new key",
  cancel: "Cancel",
  securityNotice:
    "Security notice: copy this API key now. It will not be shown again.",
  revealTitle: "API token created",
  copied: "Copied",
  copy: "Copy",
  done: "Done",
  activeTitle: "Active credentials",
  loading: "Loading API tokens...",
  empty: "No active API tokens found.",
  active: "Active",
  revoked: "Revoked",
  status: "Status",
  expires: "Expires",
  lastUsed: "Last used",
  notUsed: "Never used",
  notAvailable: "n/a",
  revoke: "Revoke",
  revokeSelected: "Revoke selected",
  confirmRevokeTitle: "Revoke API token?",
  confirmRevokeBody:
    "This immediately invalidates the token. Integrations using it will stop working.",
  actions: "Actions",
  search: "Search tokens",
  created: "API token created.",
  createFailed: "Failed to create API token.",
  revokedOk: "API token revoked.",
  revokeFailed: "Failed to revoke API token.",
};

// Backend currently accepts whole-hour TTLs only; sub-hour units need an auth-API change.
const TTL_UNIT_HOURS = { hours: 1, days: 24, weeks: 168 } as const;
type TtlUnit = keyof typeof TTL_UNIT_HOURS;

function formatDate(value: string | null | undefined, fallback: string): string {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function ApiKeysPanel({ labels }: { labels?: Partial<ApiKeysPanelLabels> }) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const {
    apiKeys: keys,
    loading,
    reload,
    create,
    createdKey: lastCreated,
    revoke,
  } = useApiKeys(false);

  const [creating, setCreating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState("");
  const [ttlAmount, setTtlAmount] = React.useState("30");
  const [ttlUnit, setTtlUnit] = React.useState<TtlUnit>("days");

  const [revealOpen, setRevealOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [revoking, setRevoking] = React.useState<ApiKeyPublic | null>(null);
  const [bulkRevoke, setBulkRevoke] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  React.useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const openCreate = () => {
    setName("");
    setTtlAmount("30");
    setTtlUnit("days");
    setCreating(true);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ttlHours = Math.max(
      1,
      Math.round((Number(ttlAmount) || 1) * TTL_UNIT_HOURS[ttlUnit]),
    );
    const parsed = ApiKeyCreateSchema.safeParse({
      name: name.trim() || t.defaultName,
      ttl_hours: ttlHours,
    });
    if (!parsed.success) {
      accountToast.error({
        title: parsed.error.issues[0]?.message ?? t.createFailed,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await create(parsed.data);
      setCreating(false);
      setCopied(false);
      setRevealOpen(true);
      accountToast.success({ title: t.created });
    } catch (error) {
      accountToast.error({ title: errorMessage(error, t.createFailed) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmRevoke = async (ids: string[]) => {
    setIsRevoking(true);
    try {
      for (const id of ids) {
        await revoke(id);
      }
      accountToast.success({ title: t.revokedOk });
      setRevoking(null);
      setBulkRevoke(false);
      setRowSelection({});
    } catch (error) {
      accountToast.error({ title: errorMessage(error, t.revokeFailed) });
    } finally {
      setIsRevoking(false);
    }
  };

  const controller = useClientTable(keys, {
    search: (key) => key.name,
    sorters: {
      name: (key) => key.name,
      status: (key) => (key.revoked ? t.revoked : t.active),
      expires: (key) => key.expires_at ?? "",
      lastUsed: (key) => key.last_used_at ?? "",
    },
    initialSortBy: "name",
  });

  const columns = React.useMemo<ColumnDef<ApiKeyPublic>[]>(
    () => [
      createDataTableSelectionColumn<ApiKeyPublic>({
        selectAllVisible: t.actions,
        selectRow: (key) => `${t.revoke} ${key.name}`,
      }),
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2" data-account-row-actions="">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={row.original.revoked}
              onClick={() => setRevoking(row.original)}
              data-account-action="revoke"
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only lg:not-sr-only">{t.revoke}</span>
            </Button>
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.name} />
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.status} />
        ),
        cell: ({ row }) =>
          row.original.revoked ? (
            <Badge variant="outline">{t.revoked}</Badge>
          ) : (
            <Badge>{t.active}</Badge>
          ),
      },
      {
        accessorKey: "expires",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.expires} />
        ),
        cell: ({ row }) => formatDate(row.original.expires_at, t.notAvailable),
      },
      {
        accessorKey: "lastUsed",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.lastUsed} />
        ),
        cell: ({ row }) => formatDate(row.original.last_used_at, t.notUsed),
      },
    ],
    [t],
  );

  // A token has no editable fields — both row actions revoke, and a single
  // confirm dialog covers the individual revoke path.
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  return (
    <div className="not-content w-full space-y-6">
      <AccountToastHost />
      <Card>
        <CardHeader>
          <CardTitle>{t.activeTitle}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<ApiKeyPublic, unknown>
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
            loading={loading && keys.length === 0}
            getRowId={(key) => key.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            labels={{
              loading: t.loading,
              empty: t.empty,
              toolbar: { search: t.search },
            }}
            addButton={
              <Button type="button" size="sm" onClick={openCreate}>
                <KeyRound className="size-4" />
                {t.mint}
              </Button>
            }
            selectionActions={
              selectedIds.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkRevoke(true)}
                >
                  {t.revokeSelected} ({selectedIds.length})
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>

      {/* Create token popup */}
      <EntityFormDialog
        open={creating}
        onOpenChange={setCreating}
        title={t.createTitle}
        description={t.createDescription}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="api-key-name">{t.name}</Label>
            <Input
              id="api-key-name"
              aria-label={t.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.namePlaceholder}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="api-key-ttl">{t.ttl}</Label>
              <Input
                id="api-key-ttl"
                type="number"
                min={1}
                value={ttlAmount}
                onChange={(event) => setTtlAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="api-key-unit">{t.ttlUnit}</Label>
              <select
                id="api-key-unit"
                aria-label={t.ttlUnit}
                value={ttlUnit}
                onChange={(event) => setTtlUnit(event.target.value as TtlUnit)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="hours">{t.unitHours}</option>
                <option value="days">{t.unitDays}</option>
                <option value="weeks">{t.unitWeeks}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreating(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.generating : t.mint}
            </Button>
          </DialogFooter>
        </form>
      </EntityFormDialog>

      {/* One-time plaintext reveal */}
      <Dialog
        open={revealOpen && Boolean(lastCreated)}
        onOpenChange={setRevealOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.revealTitle}</DialogTitle>
            <DialogDescription>{t.securityNotice}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
            <span className="flex-1 select-all break-all">
              {lastCreated?.plaintext}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => lastCreated && handleCopy(lastCreated.plaintext)}
            >
              {copied ? t.copied : t.copy}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRevealOpen(false)}>
              {t.done}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmations */}
      <ConfirmDeleteDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={t.confirmRevokeTitle}
        description={t.confirmRevokeBody}
        confirmLabel={t.revoke}
        cancelLabel={t.cancel}
        pending={isRevoking}
        onConfirm={() => revoking && confirmRevoke([revoking.id])}
      />
      <ConfirmDeleteDialog
        open={bulkRevoke}
        onOpenChange={setBulkRevoke}
        title={t.confirmRevokeTitle}
        description={t.confirmRevokeBody}
        confirmLabel={t.revokeSelected}
        cancelLabel={t.cancel}
        pending={isRevoking}
        onConfirm={() => confirmRevoke(selectedIds)}
      />
    </div>
  );
}
