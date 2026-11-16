"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getPlatformStats } from "@/lib/api/admin";
import type { StatsRange } from "@/lib/api/cafeteria";
import { useApi } from "@/lib/hooks/useApi";
import { formatRs, statusLabel } from "@/lib/utils";
import { useState } from "react";

export default function AnalyticsPage() {
  const [range, setRange] = useState<StatsRange>("week");
  const { data: s } = useApi(() => getPlatformStats(range), [range]);
  const hours = s?.byHour ?? [];
  const max = Math.max(1, ...hours.map((p) => p.value));
  const vmax = Math.max(1, ...(s?.byVendor ?? []).map((v) => v.revenue));
  const smax = Math.max(1, ...(s?.byStatus ?? []).map((v) => v.count));

  return (
    <div className="space-y-6">
      <PageIntro crumb="Admin / Reports" title="Peak hours across the campus." subtitle="Orders by hour (campus time), revenue by vendor and order outcomes." />
      <div className="flex flex-wrap gap-2">
        {(["today", "week", "month"] as const).map((r) => (
          <Button key={r} size="sm" variant={range === r ? "primary" : "outline"} onClick={() => setRange(r)}>
            {r === "today" ? "Today" : r === "week" ? "7 days" : "30 days"}
          </Button>
        ))}
      </div>
      <Card>
        <p className="mb-6 text-sm text-muted">Orders by hour · {s?.orders.total ?? 0} orders</p>
        <div className="flex h-48 items-end gap-2">
          {hours.map((p) => (
            <div key={p.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${p.value} orders`}>
              <span className="text-[10px] text-muted">{p.value || ""}</span>
              <div className="w-full rounded-t-lg bg-brand/80" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
              <span className="text-[10px] text-muted">{p.hour}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Revenue by vendor</h2>
          <div className="mt-4 space-y-3">
            {(s?.byVendor ?? []).map((v) => (
              <div key={v.name}>
                <div className="flex justify-between text-sm">
                  <span>{v.name}</span>
                  <span className="text-muted">
                    {formatRs(v.revenue)} · {v.orders} orders
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-brand" style={{ width: `${(v.revenue / vmax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Orders by status</h2>
          <div className="mt-4 space-y-3">
            {(s?.byStatus ?? []).map((v) => (
              <div key={v.status}>
                <div className="flex justify-between text-sm">
                  <span>{statusLabel(v.status)}</span>
                  <span className="text-muted">{v.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                  <div className={`h-full ${v.status === "cancelled" ? "bg-danger" : "bg-brand"}`} style={{ width: `${(v.count / smax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
