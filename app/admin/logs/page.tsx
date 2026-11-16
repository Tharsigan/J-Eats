"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLogs, getSettings, resetDemoData, saveSettings } from "@/lib/api/admin";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { useAuthStore } from "@/lib/stores/auth";
import { useCartStore } from "@/lib/stores/cart";
import type { PlatformSettings } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LEVELS = ["all", "info", "ok", "warn", "error"] as const;

export default function LogsPage() {
  const router = useRouter();
  const { data: logs } = useApi(getLogs);
  const { data: saved } = useApi(getSettings);
  const [draft, setForm] = useState<PlatformSettings | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);
  const { busy, error, message, run } = useAction();

  const form = draft ?? saved ?? null;

  const rows = (logs ?? []).filter((l) => level === "all" || l.level === level);
  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setForm(form ? { ...form, [k]: v } : null);
  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved);

  async function reset() {
    const ok = await run("reset", resetDemoData, "Demo data restored.");
    if (ok) {
      clearCart();
      logout();
      router.push("/login");
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Admin / System Settings & Role Access"
        title="Who can do what, and what just happened."
        subtitle="Platform settings, role access and the live activity log."
      />
      <Card>
        <h2 className="font-bold">Platform settings</h2>
        {form ? (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("save", () => saveSettings(form), "Settings saved. Checkout and rider payouts use the new values.").then((r) => r && setForm(null));
            }}
          >
            <label className="text-sm font-semibold">
              Delivery fee (Rs.)
              <input className="field mt-1" type="number" min={0} value={form.deliveryFee} onChange={(e) => set("deliveryFee", Number(e.target.value))} />
            </label>
            <label className="text-sm font-semibold">
              Rider payout per delivery (Rs.)
              <input className="field mt-1" type="number" min={0} value={form.riderPayout} onChange={(e) => set("riderPayout", Number(e.target.value))} />
            </label>
            <label className="text-sm font-semibold">
              Cash orders accepted until (hour, 0–23)
              <input
                className="field mt-1"
                type="number"
                min={0}
                max={23}
                value={form.cashCutoffHour}
                onChange={(e) => set("cashCutoffHour", Number(e.target.value))}
              />
            </label>
            <label className="text-sm font-semibold">
              Max active jobs per rider
              <input
                className="field mt-1"
                type="number"
                min={1}
                max={3}
                value={form.maxActiveJobsPerRider}
                onChange={(e) => set("maxActiveJobsPerRider", Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" checked={form.orderingOpen} onChange={(e) => set("orderingOpen", e.target.checked)} />
              Ordering open for customers
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="soft" size="sm" disabled={!dirty || busy === "save"}>
                Save settings
              </Button>
              {dirty && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>
                  Discard changes
                </Button>
              )}
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted">Loading settings…</p>
        )}
        {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
        {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
      </Card>
      <Card>
        <h2 className="font-bold">Role access</h2>
        <p className="mt-2 text-sm text-muted">
          Administrators approve customers, riders and cafeterias. Customers share the same ordering permissions regardless of identity label.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="soft">Customer · order</Badge>
          <Badge tone="soft">Rider · delivery</Badge>
          <Badge tone="soft">Cafeteria · kitchen</Badge>
          <Badge tone="warn">Admin · restricted</Badge>
        </div>
      </Card>
      <Card>
        <h2 className="font-bold">Demo data</h2>
        <p className="mt-2 text-sm text-muted">
          All demo data lives in this browser&apos;s localStorage. Resetting restores the original seed (orders, users, wallets) and signs you out.
        </p>
        <div className="mt-3 flex gap-2">
          {confirmReset ? (
            <>
              <Button variant="danger" size="sm" disabled={busy === "reset"} onClick={() => void reset()}>
                Yes, reset everything
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          )}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 font-bold">Activity log</h2>
        {LEVELS.map((l) => (
          <Button key={l} size="sm" variant={level === l ? "soft" : "outline"} onClick={() => setLevel(l)} className="uppercase">
            {l}
          </Button>
        ))}
      </div>
      {rows.length === 0 && <Card className="text-sm text-muted">No log entries.</Card>}
      {rows.slice(0, 100).map((l) => (
        <Card key={l.id} className="flex items-start justify-between gap-3 py-3">
          <div>
            <p className={`text-xs uppercase tracking-wide ${l.level === "warn" ? "text-amber-600" : l.level === "ok" ? "text-brand" : "text-muted"}`}>
              {l.level}
            </p>
            <p>{l.msg}</p>
          </div>
          <span className="shrink-0 text-xs text-muted">{formatWhen(l.createdAt, l.at)}</span>
        </Card>
      ))}
    </div>
  );
}
