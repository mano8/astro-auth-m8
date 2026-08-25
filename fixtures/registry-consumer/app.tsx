// Mounts every installed skin the way a consumer would, so the gate checks the
// props each one publishes and not only that its module compiles in isolation.
//
// The skin files themselves are copied in by `scripts/verify-registry-consumer.mjs`
// from the generated `registry/r/*.json`, at the same `target` paths a shadcn
// install would use.
import * as React from "react";

import AccountDashboard from "./components/fa-auth/account-dashboard";
import { ActivityBarChart } from "./components/fa-auth/activity-bar-chart";
import { AdminUsersPanel } from "./components/fa-auth/admin-users-panel";
import { ApiKeysPanel } from "./components/fa-auth/api-keys-panel";
import { DashboardOverview } from "./components/fa-auth/dashboard-overview";
import { ProfilePanel } from "./components/fa-auth/profile-panel";
import { SecurityPanel } from "./components/fa-auth/security-panel";
import { SessionsPanel } from "./components/fa-auth/sessions-panel";

export function RegistryConsumerFixture(): React.JSX.Element {
  return (
    <main>
      <AccountDashboard />
      <DashboardOverview />
      <ProfilePanel />
      <SessionsPanel />
      <ApiKeysPanel />
      <SecurityPanel />
      <AdminUsersPanel />
      <ActivityBarChart data={[]} />
    </main>
  );
}
