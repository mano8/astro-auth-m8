"use client";

// Shared skin helpers for the fa-auth account management panels (API keys +
// admin users). Composes the canonical @mano8/astro-ui-m8 data-table and toast
// blocks (copied into `@/components/m8-ui/*`) into the CRUD idioms the panels
// share: a client-side controller for the server data-table, a popup form
// dialog, a delete confirmation alert, the fixed row-actions cell, and the
// bottom-right toast host. Copied into the consumer via the @fa-m8-auth
// registry — edit freely per app.
import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DataTableSortDirection } from "@/components/m8-ui/data-table";
import {
  ToastNotificationHost,
  toastNotification,
} from "@/components/m8-ui/toast-notification";

// Bottom-right toast host + helpers for every account surface. Mount the host
// once in the account shell; call `accountToast.success/error/info` from
// mutation callbacks.
export function AccountToastHost() {
  return <ToastNotificationHost position="bottom-right" />;
}
export const accountToast = toastNotification;

// --- client-side controller for the canonical (server-shaped) data-table -----
// The shared data-table is a controlled/server component; this hook drives it
// entirely client-side (search + sort + paginate over an in-memory array) so
// the account panels get the page-size selector, orderable columns, and column
// visibility for free without a server list endpoint.
export interface ClientTableController<TData> {
  data: TData[];
  rowCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  sortBy?: string;
  sortDir?: DataTableSortDirection;
  onSortChange: (sortBy?: string, sortDir?: DataTableSortDirection) => void;
  q: string;
  onSearchChange: (q: string) => void;
}

export interface UseClientTableOptions<TData> {
  search?: (row: TData) => string;
  sorters?: Record<string, (row: TData) => string | number>;
  initialSortBy?: string;
  initialSortDir?: DataTableSortDirection;
  initialPageSize?: number;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function useClientTable<TData>(
  rows: TData[],
  options: UseClientTableOptions<TData> = {},
): ClientTableController<TData> {
  const {
    search,
    sorters,
    initialSortBy,
    initialSortDir = "asc",
    initialPageSize = 10,
  } = options;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [sortBy, setSortBy] = React.useState<string | undefined>(initialSortBy);
  const [sortDir, setSortDir] = React.useState<DataTableSortDirection | undefined>(
    initialSortBy ? initialSortDir : undefined,
  );
  const [q, setQ] = React.useState("");

  const normalizedQuery = q.trim().toLocaleLowerCase();
  const filtered = React.useMemo(() => {
    if (!normalizedQuery || !search) return rows;
    return rows.filter((row) =>
      search(row).toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [rows, normalizedQuery, search]);

  const sorted = React.useMemo(() => {
    const sorter = sortBy && sorters ? sorters[sortBy] : undefined;
    if (!sorter || !sortDir) return filtered;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => compareValues(sorter(a), sorter(b)) * direction,
    );
  }, [filtered, sortBy, sortDir, sorters]);

  const rowCount = sorted.length;
  const pageCount = Math.max(1, Math.ceil(rowCount / Math.max(1, pageSize)));
  const currentPage = Math.min(page, pageCount);
  const pageRows = React.useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  return {
    data: pageRows,
    rowCount,
    page: currentPage,
    pageSize,
    onPageChange: setPage,
    onPageSizeChange: (next) => {
      setPageSize(next);
      setPage(1);
    },
    sortBy,
    sortDir,
    onSortChange: (nextBy, nextDir) => {
      setSortBy(nextBy);
      setSortDir(nextDir);
      setPage(1);
    },
    q,
    onSearchChange: (next) => {
      setQ(next);
      setPage(1);
    },
  };
}

// --- fixed row-actions cell (rendered as the 2nd column) --------------------
export function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  disabled,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2" data-account-row-actions="">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onEdit}
        data-account-action="edit"
      >
        <Pencil className="size-3.5" />
        <span className="sr-only lg:not-sr-only">{editLabel}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={disabled}
        onClick={onDelete}
        data-account-action="delete"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only lg:not-sr-only">{deleteLabel}</span>
      </Button>
    </div>
  );
}

// --- popup form dialog ------------------------------------------------------
export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// --- delete confirmation alert ----------------------------------------------
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
