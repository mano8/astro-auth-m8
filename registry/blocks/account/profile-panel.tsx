"use client";

// fa-auth profile panel: edit public profile metadata + rotate password.
// Headless logic stays a live dependency — `useAuth` (@fa-m8/astro-auth-m8/react)
// supplies the signed-in user + reload, `useProfile` (@fa-m8/astro-auth-m8/hooks)
// performs the writes, and the package Zod schemas validate the form. This file
// is only the shadcn skin and is copied into the consumer via the @fa-m8-auth
// registry — edit (and translate via `labels`) freely per app.
import * as React from "react";
import { useAuth } from "@fa-m8/astro-auth-m8/react";
import { useProfile } from "@fa-m8/astro-auth-m8/hooks";
import { UserUpdateMeSchema, UpdatePasswordSchema } from "@fa-m8/astro-auth-m8/schemas";

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

export interface ProfilePanelLabels {
  title: string;
  description: string;
  saved: string;
  failed: string;
  email: string;
  emailReadOnly: string;
  fullName: string;
  avatar: string;
  avatarPlaceholder: string;
  saving: string;
  submit: string;
  passwordTitle: string;
  passwordDescription: string;
  googlePasswordDisabled: string;
  credentialsRotated: string;
  passwordFailed: string;
  currentPassword: string;
  newPassword: string;
  changePassword: string;
  incorrectPasswordError: string;
  samePasswordError: string;
}

const DEFAULT_LABELS: ProfilePanelLabels = {
  title: "Profile details",
  description: "Update your public profile metadata.",
  saved: "Profile saved.",
  failed: "Failed to update profile.",
  email: "Email address",
  emailReadOnly: "Email is managed by the auth service and cannot be changed here.",
  fullName: "Full name",
  avatar: "Avatar URL",
  avatarPlaceholder: "https://example.com/avatar.png",
  saving: "Saving...",
  submit: "Update details",
  passwordTitle: "Password management",
  passwordDescription: "Rotate your authentication credentials securely.",
  googlePasswordDisabled:
    "Your account is integrated via Google SSO. Password changes are disabled.",
  credentialsRotated: "Credentials rotated.",
  passwordFailed: "Failed to alter security credentials.",
  currentPassword: "Current password",
  newPassword: "New password",
  changePassword: "Change password",
  incorrectPasswordError: "The current password you entered is incorrect.",
  samePasswordError: "The new password must be different from your current one.",
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Map known backend (English) auth messages to the active locale, falling back to the raw message. */
function translatePasswordError(err: unknown, t: ProfilePanelLabels): string {
  const raw = errorMessage(err, t.passwordFailed);
  const known: Record<string, string> = {
    "Incorrect password": t.incorrectPasswordError,
    "New password cannot be the same as the current one": t.samePasswordError,
  };
  return known[raw] ?? raw;
}

export function ProfilePanel({ labels }: { labels?: Partial<ProfilePanelLabels> }) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { user, reload } = useAuth();
  const { save, changePassword } = useProfile(false);

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState(false);
  const [passSuccess, setPassSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setProfileSuccess(false);

    const formData = new FormData(e.currentTarget);
    // Email is not editable here; optional fields submit as null when left blank
    // so an empty avatar clears the value instead of failing URL validation.
    const result = UserUpdateMeSchema.safeParse({
      full_name: formData.get("full_name")?.toString().trim() || null,
      avatar: formData.get("avatar")?.toString().trim() || null,
    });
    if (!result.success) {
      result.error.issues.forEach((i) => setErrors((prev) => ({ ...prev, [i.path[0]]: i.message })));
      return;
    }

    setIsUpdating(true);
    try {
      await save(result.data);
      await reload();
      setProfileSuccess(true);
    } catch (err) {
      setErrors({ profileApi: errorMessage(err, t.failed) });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setPassSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData);

    const result = UpdatePasswordSchema.safeParse(rawData);
    if (!result.success) {
      result.error.issues.forEach((i) => setErrors((prev) => ({ ...prev, [i.path[0]]: i.message })));
      return;
    }

    try {
      await changePassword(result.data);
      setPassSuccess(true);
      form.reset();
    } catch (err) {
      setErrors({ passApi: translatePasswordError(err, t) });
    }
  };

  if (!user) return null;

  return (
    <div className="not-content grid auto-rows-fr gap-6 md:grid-cols-2">
      {/* Profile metadata form */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {profileSuccess && <div className="p-2 text-sm text-emerald-600 bg-emerald-50 rounded">{t.saved}</div>}
            {errors.profileApi && <div className="p-2 text-sm text-destructive bg-destructive/10 rounded">{errors.profileApi}</div>}

            <div className="space-y-1">
              <Label htmlFor="email" className="pb-2">{t.email}</Label>
              <Input id="email" value={user.email} type="email" readOnly disabled aria-readonly="true" />
              <p className="text-xs text-muted-foreground">{t.emailReadOnly}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="full_name" className="pb-2">{t.fullName}</Label>
              <Input id="full_name" name="full_name" defaultValue={user.full_name || ""} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="avatar" className="pb-2">{t.avatar}</Label>
              <Input
                id="avatar"
                name="avatar"
                type="url"
                defaultValue={user.avatar || ""}
                placeholder={t.avatarPlaceholder}
              />
              {errors.avatar && <p className="text-xs text-destructive">{errors.avatar}</p>}
            </div>

            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? t.saving : t.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password rotation (hidden for OAuth-provisioned accounts) */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{t.passwordTitle}</CardTitle>
          <CardDescription>{t.passwordDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {user.provider === "google" ? (
            <p className="text-sm text-muted-foreground italic pt-4">
              {t.googlePasswordDisabled}
            </p>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passSuccess && <div className="p-2 text-sm text-emerald-600 bg-emerald-50 rounded">{t.credentialsRotated}</div>}
              {errors.passApi && <div className="p-2 text-sm text-destructive bg-destructive/10 rounded">{errors.passApi}</div>}

              <div className="space-y-1">
                <Label htmlFor="current_password" className="pb-2">{t.currentPassword}</Label>
                <Input id="current_password" name="current_password" type="password" required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new_password" className="pb-2">{t.newPassword}</Label>
                <Input id="new_password" name="new_password" type="password" required />
                {errors.new_password && <p className="text-xs text-destructive">{errors.new_password}</p>}
              </div>

              <Button type="submit" variant="secondary">{t.changePassword}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
