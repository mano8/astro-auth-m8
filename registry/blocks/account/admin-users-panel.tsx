"use client";

// fa-auth admin users panel: superuser-only user management (create / update /
// delete). Headless logic stays a live dependency - `useUsers`
// (@mano8/astro-auth-m8/hooks) owns the API calls, the package Zod schemas
// validate the forms, and the package's `RequireRole superuser` gates the whole
// panel. This file is only the shadcn skin, copied into the consumer via the
// @fa-m8-auth registry - edit (and translate via `labels`) freely per app.
import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { UserPlus } from "lucide-react";
import { RequireRole } from "@mano8/astro-auth-m8/react";
import { useUsers } from "@mano8/astro-auth-m8/hooks";
import {
  RoleTypeSchema,
  UserCreateSchema,
  UserUpdateSchema,
  type UserPublic,
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
import { DialogFooter } from "@/components/ui/dialog";
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
  RowActions,
  errorMessage,
  useClientTable,
} from "./account-crud";

export interface AdminUsersPanelLabels {
  title: string;
  description: string;
  updateScope: string;
  invalidCreate: string;
  invalidUpdate: string;
  created: string;
  updated: string;
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
  deleted: string;
  email: string;
  fullName: string;
  avatar: string;
  avatarPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  passwordUnsupported: string;
  create: string;
  createTitle: string;
  editTitle: string;
  role: string;
  emailVerified: string;
  superuser: string;
  users: string;
  loading: string;
  provider: string;
  providerPassword: string;
  providerGoogle: string;
  actions: string;
  status: string;
  active: string;
  inactive: string;
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  deleteSelected: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  empty: string;
  search: string;
}

const DEFAULT_LABELS: AdminUsersPanelLabels = {
  title: "Admin users",
  description: "Superuser-only user management.",
  updateScope:
    "User updates support email, full name, avatar, password, and role. Provider, account status, and verification flags are managed by the auth service.",
  invalidCreate: "Invalid user payload.",
  invalidUpdate: "Invalid update payload.",
  created: "User created.",
  updated: "User updated.",
  createFailed: "Failed to create user.",
  updateFailed: "Failed to update user.",
  deleteFailed: "Failed to delete user.",
  deleted: "User deleted.",
  email: "Email",
  fullName: "Full name",
  avatar: "Avatar URL",
  avatarPlaceholder: "https://example.com/avatar.png",
  password: "Password",
  passwordPlaceholder: "Leave blank to keep current password",
  passwordUnsupported: "Password disabled for Google users",
  create: "Create user",
  createTitle: "Create user",
  editTitle: "Edit user",
  role: "Role",
  emailVerified: "Email verified",
  superuser: "Superuser",
  users: "users",
  loading: "Loading users...",
  provider: "Provider",
  providerPassword: "Password",
  providerGoogle: "Google",
  actions: "Actions",
  status: "Status",
  active: "Active",
  inactive: "Inactive",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  deleteSelected: "Delete selected",
  confirmDeleteTitle: "Delete user?",
  confirmDeleteBody:
    "This permanently removes the user account and revokes its access.",
  empty: "No users found.",
  search: "Search users",
};

interface CreateFormState {
  email: string;
  full_name: string;
  avatar: string;
  password: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
}

interface EditFormState {
  email: string;
  full_name: string;
  avatar: string;
  password: string;
  role: string;
}

const EMPTY_CREATE: CreateFormState = {
  email: "",
  full_name: "",
  avatar: "",
  password: "",
  role: "user",
  is_active: true,
  is_superuser: false,
};

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function RoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      aria-label="Role"
      className={selectClassName}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {RoleTypeSchema.options.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

function AdminUsersPanelInner({ t }: { t: AdminUsersPanelLabels }) {
  const { users: usersData, loading, reload, create, update, remove } =
    useUsers(false);
  const users = usersData?.data ?? [];

  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] =
    React.useState<CreateFormState>(EMPTY_CREATE);
  const [editing, setEditing] = React.useState<UserPublic | null>(null);
  const [editForm, setEditForm] = React.useState<EditFormState | null>(null);
  const [deleting, setDeleting] = React.useState<UserPublic | null>(null);
  const [bulkDelete, setBulkDelete] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  React.useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreating(true);
  };

  const openEdit = (user: UserPublic) => {
    setEditForm({
      email: user.email,
      full_name: user.full_name ?? "",
      avatar: user.avatar ?? "",
      password: "",
      role: user.role,
    });
    setEditing(user);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = UserCreateSchema.safeParse({
      email: createForm.email || undefined,
      password: createForm.password || undefined,
      full_name: createForm.full_name || undefined,
      avatar: createForm.avatar || undefined,
      provider: "password",
      role: createForm.role ? RoleTypeSchema.parse(createForm.role) : "user",
      is_active: createForm.is_active,
      is_superuser: createForm.is_superuser,
    });
    if (!parsed.success) {
      accountToast.error({
        title: parsed.error.issues[0]?.message ?? t.invalidCreate,
      });
      return;
    }
    setSubmitting(true);
    try {
      await create(parsed.data);
      // The hook query is disabled (useUsers(false)), so invalidation alone
      // won't repopulate the table — refetch explicitly.
      await reload();
      setCreating(false);
      accountToast.success({ title: t.created });
    } catch (error) {
      accountToast.error({ title: errorMessage(error, t.createFailed) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !editForm) return;
    const parsed = UserUpdateSchema.safeParse({
      email: editForm.email || undefined,
      full_name: editForm.full_name || undefined,
      avatar: editForm.avatar || undefined,
      password: editForm.password || undefined,
      role: editForm.role || undefined,
    });
    if (!parsed.success) {
      accountToast.error({
        title: parsed.error.issues[0]?.message ?? t.invalidUpdate,
      });
      return;
    }
    setSubmitting(true);
    try {
      await update(editing.id, parsed.data);
      await reload();
      setEditing(null);
      setEditForm(null);
      accountToast.success({ title: t.updated });
    } catch (error) {
      accountToast.error({ title: errorMessage(error, t.updateFailed) });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (ids: string[]) => {
    setSubmitting(true);
    try {
      for (const id of ids) {
        await remove(id);
      }
      await reload();
      accountToast.success({ title: t.deleted });
      setDeleting(null);
      setBulkDelete(false);
      setRowSelection({});
    } catch (error) {
      accountToast.error({ title: errorMessage(error, t.deleteFailed) });
    } finally {
      setSubmitting(false);
    }
  };

  const controller = useClientTable(users, {
    search: (user) => `${user.email} ${user.full_name ?? ""}`,
    sorters: {
      email: (user) => user.email,
      role: (user) => user.role,
      provider: (user) => user.provider,
      status: (user) => (user.is_active ? t.active : t.inactive),
    },
    initialSortBy: "email",
  });

  const columns = React.useMemo<ColumnDef<UserPublic>[]>(
    () => [
      createDataTableSelectionColumn<UserPublic>({
        selectAllVisible: t.actions,
        selectRow: (user) => `${t.edit} ${user.email}`,
      }),
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions
            editLabel={t.edit}
            deleteLabel={t.delete}
            onEdit={() => openEdit(row.original)}
            onDelete={() => setDeleting(row.original)}
          />
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.email} />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.email}</div>
            {row.original.full_name ? (
              <div className="text-xs text-muted-foreground">
                {row.original.full_name}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.role} />
        ),
        cell: ({ row }) => (
          <span className="capitalize">{row.original.role}</span>
        ),
      },
      {
        accessorKey: "provider",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.provider} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.provider === "google"
              ? t.providerGoogle
              : t.providerPassword}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.status} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              <Badge variant={user.is_active ? "default" : "outline"}>
                {user.is_active ? t.active : t.inactive}
              </Badge>
              {user.email_verified ? (
                <Badge variant="secondary">{t.emailVerified}</Badge>
              ) : null}
              {user.is_superuser ? (
                <Badge variant="secondary">{t.superuser}</Badge>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t],
  );

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const editingGoogle = editing?.provider === "google";

  return (
    <Card className="not-content w-full">
      <AccountToastHost />
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.updateScope}</p>
        <DataTable<UserPublic, unknown>
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
          loading={loading && users.length === 0}
          getRowId={(user) => user.id}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          labels={{
            loading: t.loading,
            empty: t.empty,
            toolbar: { search: t.search },
          }}
          addButton={
            <Button type="button" size="sm" onClick={openCreate}>
              <UserPlus className="size-4" />
              {t.create}
            </Button>
          }
          selectionActions={
            selectedIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setBulkDelete(true)}
              >
                {t.deleteSelected} ({selectedIds.length})
              </Button>
            ) : null
          }
        />
      </CardContent>

      {/* Create popup */}
      <EntityFormDialog
        open={creating}
        onOpenChange={setCreating}
        title={t.createTitle}
        description={t.updateScope}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-create-email">{t.email}</Label>
              <Input
                id="admin-create-email"
                type="email"
                required
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-create-name">{t.fullName}</Label>
              <Input
                id="admin-create-name"
                value={createForm.full_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-create-avatar">{t.avatar}</Label>
              <Input
                id="admin-create-avatar"
                type="url"
                placeholder={t.avatarPlaceholder}
                value={createForm.avatar}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    avatar: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-create-password">{t.password}</Label>
              <Input
                id="admin-create-password"
                type="password"
                minLength={8}
                required
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-create-role">{t.role}</Label>
              <RoleSelect
                id="admin-create-role"
                value={createForm.role}
                onChange={(role) => setCreateForm((prev) => ({ ...prev, role }))}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={createForm.is_active}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      is_active: event.target.checked,
                    }))
                  }
                />
                {t.active}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={createForm.is_superuser}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      is_superuser: event.target.checked,
                    }))
                  }
                />
                {t.superuser}
              </label>
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
            <Button type="submit" disabled={submitting}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </EntityFormDialog>

      {/* Edit popup */}
      <EntityFormDialog
        open={Boolean(editing) && Boolean(editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditForm(null);
          }
        }}
        title={t.editTitle}
        description={editing?.email}
      >
        {editForm ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="admin-edit-email">{t.email}</Label>
                <Input
                  id="admin-edit-email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, email: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-edit-name">{t.fullName}</Label>
                <Input
                  id="admin-edit-name"
                  value={editForm.full_name}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, full_name: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-edit-avatar">{t.avatar}</Label>
                <Input
                  id="admin-edit-avatar"
                  type="url"
                  placeholder={t.avatarPlaceholder}
                  value={editForm.avatar}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, avatar: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-edit-password">{t.password}</Label>
                <Input
                  id="admin-edit-password"
                  type="password"
                  disabled={editingGoogle}
                  placeholder={
                    editingGoogle
                      ? t.passwordUnsupported
                      : t.passwordPlaceholder
                  }
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, password: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-edit-role">{t.role}</Label>
                <RoleSelect
                  id="admin-edit-role"
                  value={editForm.role}
                  onChange={(role) =>
                    setEditForm((prev) => (prev ? { ...prev, role } : prev))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={submitting}>
                {t.save}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </EntityFormDialog>

      {/* Delete confirmations */}
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t.confirmDeleteTitle}
        description={t.confirmDeleteBody}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        pending={submitting}
        onConfirm={() => deleting && confirmDelete([deleting.id])}
      />
      <ConfirmDeleteDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={t.confirmDeleteTitle}
        description={t.confirmDeleteBody}
        confirmLabel={t.deleteSelected}
        cancelLabel={t.cancel}
        pending={submitting}
        onConfirm={() => confirmDelete(selectedIds)}
      />
    </Card>
  );
}

export function AdminUsersPanel({
  labels,
}: {
  labels?: Partial<AdminUsersPanelLabels>;
}) {
  const t = { ...DEFAULT_LABELS, ...labels };
  // Superuser-only: gate the whole panel via the package's RequireRole so the
  // privileged API calls never mount for non-superusers, even if a consumer
  // renders it unconditionally.
  return (
    <RequireRole superuser>
      <AdminUsersPanelInner t={t} />
    </RequireRole>
  );
}
