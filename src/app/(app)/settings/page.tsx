"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/app-store";
import { ThemeToggle } from "@/components/theme-toggle";

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border py-6 first:pt-0 last:border-0 sm:grid-cols-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="space-y-4 sm:col-span-2">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const setAutoRefresh = useAppStore((s) => s.setAutoRefresh);
  const refreshIntervalMs = useAppStore((s) => s.refreshIntervalMs);
  const setRefreshInterval = useAppStore((s) => s.setRefreshInterval);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Account, alerts, and preferences</p>
      </div>

      <SettingsSection title="Account">
        {session?.user ? (
          <>
            <p className="text-sm">
              Signed in as <strong>{session.user.email}</strong>
            </p>
            <Button variant="secondary" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => signIn("github")}>
              GitHub
            </Button>
            <Button variant="secondary" size="sm" onClick={() => signIn("google")}>
              Google
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Display">
        <ThemeToggle />
      </SettingsSection>

      <SettingsSection title="Data refresh">
        <div className="flex items-center justify-between">
          <span className="text-sm">Auto-refresh</span>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Interval (ms)</span>
          <Input
            type="number"
            value={refreshIntervalMs}
            onChange={(e) => setRefreshInterval(Number(e.target.value) || 30000)}
            className="max-w-xs"
          />
        </label>
      </SettingsSection>

      <SettingsSection title="Alerts">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Discord webhook</span>
          <Input placeholder="https://discord.com/api/webhooks/..." disabled />
        </label>
        <p className="text-xs text-muted-foreground">
          Configure DISCORD_WEBHOOK_URL in environment for server-side alerts.
        </p>
      </SettingsSection>
    </div>
  );
}
