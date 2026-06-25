"use client";

// fa-auth admin users panel: superuser-only user management (create / update /
// delete). Headless logic stays a live dependency — `useUsers`
// (@fa-m8/astro-auth-m8/hooks) owns the API calls, the package Zod schemas
// validate the forms, and the package's `RequireRole superuser` gates the whole
// panel. This file is only the shadcn skin, copied into the consumer via the
// @fa-m8-auth registry — edit (and translate via `labels`) freely per app.
import * as React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { RequireRole } from "@fa-m8/astro-auth-m8/react";
import { useUsers } from "@fa-m8/astro-auth-m8/hooks";
import { RoleTypeSchema, UserCreateSchema, UserUpdateSchema } from "@fa-m8/astro-auth-m8/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  email: string;
  fullName: string;
  avatar: string;
  avatarPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  passwordUnsupported: string;
  create: string;
  role: string;
  emailVerified: string;
  superuser: string;
  users: string;
  refresh: string;
  loading: string;
  user: string;
  provider: string;
  providerPassword: string;
  providerGoogle: string;
  actions: string;
  active: string;
  inactive: string;
  save: string;
  delete: string;
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
  email: "Email",
  fullName: "Full name",
  avatar: "Avatar URL",
  avatarPlaceholder: "https://example.com/avatar.png",
  password: "Password",
  passwordPlaceholder: "Leave blank to keep current password",
  passwordUnsupported: "Password disabled for Google users",
  create: "Create",
  role: "Role",
  emailVerified: "Email verified",
  superuser: "Superuser",
  users: "users",
  refresh: "Refresh",
  loading: "Loading users...",
  user: "User",
  provider: "Provider",
  providerPassword: "Password",
  providerGoogle: "Google",
  actions: "Actions",
  active: "Active",
  inactive: "Inactive",
  save: "Save",
  delete: "Delete",
};

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const inputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

function AdminUsersPanelInner({ t }: { t: AdminUsersPanelLabels }) {
  const { users: usersData, loading, error, reload, create, update, remove } = useUsers(false);
  const users = usersData?.data ?? [];
  const count = usersData?.count ?? 0;
  const errorText = error instanceof Error ? error.message : error ? String(error) : null;
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const role = formString(formData, "role");
    // Superadmins create password-based accounts only; OAuth credentials and the
    // email_verified flag are owned by the auth service's internal sign-in flow.
    const parsed = UserCreateSchema.safeParse({
      email: formString(formData, "email"),
      password: formString(formData, "password"),
      full_name: formString(formData, "full_name"),
      avatar: formString(formData, "avatar"),
      provider: "password",
      role: role ? RoleTypeSchema.parse(role) : "user",
      is_active: formData.get("is_active") === "on",
      is_superuser: formData.get("is_superuser") === "on",
    });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? t.invalidCreate);
      return;
    }

    try {
      await create(parsed.data);
      await reload();
      form.reset();
      setMessage(t.created);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.createFailed);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    // Provider and OAuth user ID are owned by the auth service and not editable here.
    const parsed = UserUpdateSchema.safeParse({
      email: formString(formData, "email"),
      full_name: formString(formData, "full_name"),
      avatar: formString(formData, "avatar"),
      password: formString(formData, "password"),
      role: formString(formData, "role"),
    });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? t.invalidUpdate);
      return;
    }

    try {
      await update(id, parsed.data);
      await reload();
      setMessage(t.updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.updateFailed);
    }
  };

  return (
    <Card className="not-content">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {t.updateScope}
        </p>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 md:items-end">
          <div className="space-y-1">
            <Label htmlFor="admin-create-email" className="pb-2">{t.email}</Label>
            <Input id="admin-create-email" name="email" type="email" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-create-name" className="pb-2">{t.fullName}</Label>
            <Input id="admin-create-name" name="full_name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-create-avatar" className="pb-2">{t.avatar}</Label>
            <Input id="admin-create-avatar" name="avatar" type="url" placeholder={t.avatarPlaceholder} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-create-password" className="pb-2">{t.password}</Label>
            <Input id="admin-create-password" name="password" type="password" minLength={8} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-create-role" className="pb-2">{t.role}</Label>
            <select id="admin-create-role" name="role" defaultValue="user" className={inputClassName}>
              {RoleTypeSchema.options.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked className="size-4" />
            {t.active}
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input name="is_superuser" type="checkbox" className="size-4" />
            {t.superuser}
          </label>
          <Button type="submit">{t.create}</Button>
        </form>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{count} {t.users}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => reload()}>
            <RefreshCw />
            {t.refresh}
          </Button>
        </div>

        {(message || errorText) && (
          <p className="rounded-md border p-3 text-sm">{message ?? errorText}</p>
        )}

        {loading && users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.user}</th>
                  <th className="px-3 py-2 font-medium">{t.role}</th>
                  <th className="px-3 py-2 font-medium">{t.provider}</th>
                  <th className="px-3 py-2 font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-3 align-top">
                      <form id={`admin-user-${user.id}`} onSubmit={(event) => handleUpdate(event, user.id)} className="grid gap-2">
                        <Input name="email" type="email" defaultValue={user.email} required />
                        <Input name="full_name" defaultValue={user.full_name ?? ""} placeholder={t.fullName} />
                        <Input name="avatar" type="url" defaultValue={user.avatar ?? ""} placeholder={t.avatarPlaceholder} />
                        <Input
                          name="password"
                          type="password"
                          placeholder={user.provider === "password" ? t.passwordPlaceholder : t.passwordUnsupported}
                          disabled={user.provider === "google"}
                        />
                      </form>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select name="role" form={`admin-user-${user.id}`} defaultValue={user.role} className={inputClassName}>
                        {RoleTypeSchema.options.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex h-8 items-center rounded-md border bg-muted/40 px-2 text-sm capitalize">
                        {user.provider === "google" ? t.providerGoogle : t.providerPassword}
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {user.is_active ? t.active : t.inactive}
                        {user.email_verified ? ` - ${t.emailVerified}` : ""}
                        {user.is_superuser ? ` - ${t.superuser}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex gap-2">
                        <Button type="submit" form={`admin-user-${user.id}`} size="sm">{t.save}</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            await remove(user.id);
                            await reload();
                          }}
                        >
                          <Trash2 />
                          {t.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUsersPanel({ labels }: { labels?: Partial<AdminUsersPanelLabels> }) {
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
