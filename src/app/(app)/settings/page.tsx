"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/app-store";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  const { data: session } = useSession();
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const setAutoRefresh = useAppStore((s) => s.setAutoRefresh);
  const refreshIntervalMs = useAppStore((s) => s.refreshIntervalMs);
  const setRefreshInterval = useAppStore((s) => s.setRefreshInterval);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-zinc-500">Account, alerts, and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session?.user ? (
            <>
              <p className="text-sm">
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <Button variant="secondary" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => signIn("github")}>GitHub</Button>
              <Button variant="secondary" onClick={() => signIn("google")}>
                Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data refresh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Auto-refresh</span>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Interval (ms)</span>
            <Input
              type="number"
              value={refreshIntervalMs}
              onChange={(e) => setRefreshInterval(Number(e.target.value) || 30000)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alerts (Discord webhook)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="https://discord.com/api/webhooks/..." disabled />
          <p className="mt-2 text-xs text-zinc-500">
            Configure DISCORD_WEBHOOK_URL in environment for server-side alerts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
