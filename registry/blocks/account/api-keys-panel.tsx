"use client";

// fa-auth API keys panel: mint and revoke programmatic API tokens. Headless
// logic stays a live dependency — `useApiKeys` (@fa-m8/astro-auth-m8/hooks) owns
// the list/create/revoke calls and the package Zod schema validates the form.
// This file is only the shadcn skin, copied into the consumer via the
// @fa-m8-auth registry — edit (and translate via `labels`) freely per app.
import * as React from "react";
import { useApiKeys } from "@fa-m8/astro-auth-m8/hooks";
import { ApiKeyCreateSchema } from "@fa-m8/astro-auth-m8/schemas";

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

export interface ApiKeysPanelLabels {
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
  securityNotice: string;
  copied: string;
  copy: string;
  activeTitle: string;
  loading: string;
  empty: string;
  active: string;
  revoked: string;
  expires: string;
  lastUsed: string;
  notUsed: string;
  notAvailable: string;
  revoke: string;
}

const DEFAULT_LABELS: ApiKeysPanelLabels = {
  createTitle: "Create API token",
  createDescription: "Provision programmatic client identifiers for remote integrations.",
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
  securityNotice: "Security notice: copy this API key now. It will not be shown again.",
  copied: "Copied",
  copy: "Copy",
  activeTitle: "Active credentials",
  loading: "Loading API tokens...",
  empty: "No active API tokens found.",
  active: "Active",
  revoked: "Revoked",
  expires: "Expires",
  lastUsed: "Last used",
  notUsed: "Never used",
  notAvailable: "n/a",
  revoke: "Revoke token",
};

// Backend currently accepts whole-hour TTLs only; sub-hour units need an auth-API change.
const TTL_UNIT_HOURS = { hours: 1, days: 24, weeks: 168 } as const;
type TtlUnit = keyof typeof TTL_UNIT_HOURS;

export function ApiKeysPanel({ labels }: { labels?: Partial<ApiKeysPanelLabels> }) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { apiKeys: keys, loading, reload, create, createdKey: lastCreated, revoke } = useApiKeys(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const handleCreateToken = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCopied(false);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const amount = Number(formData.get("ttl_amount")) || 1;
    const unit = (formData.get("ttl_unit")?.toString() as TtlUnit) || "days";
    const ttl_hours = Math.max(1, Math.round(amount * (TTL_UNIT_HOURS[unit] ?? 24)));

    const parsedData = ApiKeyCreateSchema.parse({
      name: formData.get("name")?.toString() || t.defaultName,
      ttl_hours,
    });

    setIsCreating(true);
    try {
      await create(parsedData);
      form.reset();
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.createTitle}</CardTitle>
          <CardDescription>{t.createDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateToken} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="name">{t.name}</Label>
              <Input id="name" name="name" placeholder={t.namePlaceholder} required />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor="ttl_amount">{t.ttl}</Label>
              <Input id="ttl_amount" name="ttl_amount" type="number" min={1} defaultValue="30" required />
            </div>
            <div className="w-32 space-y-1">
              <Label htmlFor="ttl_unit">{t.ttlUnit}</Label>
              <select
                id="ttl_unit"
                name="ttl_unit"
                defaultValue="days"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="hours">{t.unitHours}</option>
                <option value="days">{t.unitDays}</option>
                <option value="weeks">{t.unitWeeks}</option>
              </select>
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? t.generating : t.mint}
            </Button>
          </form>

          {lastCreated && (
            <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-md text-amber-900 space-y-2">
              <p className="text-sm font-bold">{t.securityNotice}</p>
              <div className="flex items-center gap-2 bg-white p-2 rounded border font-mono text-xs overflow-x-auto">
                <span className="flex-1 select-all break-all">{lastCreated.plaintext}</span>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(lastCreated.plaintext)}>
                  {copied ? t.copied : t.copy}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.activeTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && keys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 italic">{t.loading}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 italic">{t.empty}</p>
          ) : (
            <div className="divide-y divide-border">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{key.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t.expires}: {key.expires_at ? new Date(key.expires_at).toLocaleString() : t.notAvailable}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.lastUsed}: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : t.notUsed}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {key.revoked ? t.revoked : t.active}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={key.revoked}
                    onClick={() => revoke(key.id)}
                  >
                    {t.revoke}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
