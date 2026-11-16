"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { broadcastQueue, getMyVendor, getQueue, getVendorStats } from "@/lib/api/cafeteria";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { formatRs } from "@/lib/utils";
import { useState } from "react";

export default function QueuePage() {
  const { data: queue } = useApi(getQueue);
  const { data: vendor } = useApi(getMyVendor);
  const { data: stats } = useApi(() => getVendorStats("week"), []);
  const [n, setN] = useState<number | null>(null);
  const { busy, message, error, run } = useAction();

  const value = n ?? queue?.queueLength ?? 0;
  const hours = stats?.byHour ?? [];
  const max = Math.max(1, ...hours.map((p) => p.value));
  const waitMin = Math.round(value * 1.5);

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Cafeteria / Analytics"
        title="See the lunch wave coming."
        subtitle="Broadcast your queue length to customers, plus this week's peak-hour chart."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <p className="text-sm text-muted">People waiting at {vendor?.name ?? "your counter"}</p>
          <p className="text-6xl font-bold">{value}</p>
          <p className="text-sm text-muted">≈ {waitMin} min wait · currently broadcast: {queue?.queueLength ?? 0}</p>
          <input type="range" min={0} max={40} value={value} onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy === "b" || value === queue?.queueLength}
              onClick={() => void run("b", () => broadcastQueue(value), (r) => `Broadcast sent · ${r.queueLength} in line. Customers see it on Explore Food.`)}
            >
              Broadcast to campus
            </Button>
            <Button variant="outline" onClick={() => setN(0)}>
              Queue cleared
            </Button>
          </div>
          {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
          {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
        </Card>
        <Card>
          <p className="mb-4 text-sm font-semibold">Orders by hour · last 7 days</p>
          <div className="flex h-40 items-end gap-2">
            {hours.map((p) => (
              <div key={p.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${p.value} orders`}>
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
                <span className="text-[10px] text-muted">{p.hour}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Week revenue {formatRs(stats?.sales ?? 0)} · {stats?.completed ?? 0} completed · busiest hour{" "}
            {hours.length ? `${[...hours].sort((a, b) => b.value - a.value)[0].hour}:00` : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
