"use client";

import { PendingApprovals } from "@/components/admin/PendingApprovals";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getLogs, getPlatformStats, getSettings, listAllOrders } from "@/lib/api/admin";
import type { StatsRange } from "@/lib/api/cafeteria";
import { useApi } from "@/lib/hooks/useApi";
import { formatRs, formatWhen, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];

const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : "0%");

export default function AdminHome() {
  const [range, setRange] = useState<StatsRange>("today");
  const { data: s } = useApi(() => getPlatformStats(range), [range]);
  const { data: logs } = useApi(getLogs);
  const { data: orders } = useApi(listAllOrders);
  const { data: settings } = useApi(getSettings);
  const max = Math.max(1, ...(s?.byHour ?? []).map((p) => p.value));
  const label = RANGES.find((r) => r.id === range)!.label;
  const live = (orders ?? []).filter((o) => ["placed", "accepted", "preparing", "ready", "out_for_delivery"].includes(o.status));

  return (
    <div>
      <PageIntro
        crumb="Admin / Overview"
        title="A clear view of campus operations."
        subtitle="Authorised administrator · Live demo platform overview"
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button key={r.id} size="sm" variant={range === r.id ? "primary" : "outline"} onClick={() => setRange(r.id)}>
            {r.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Customers"
          value={String(s?.customers.total ?? 0)}
          hint={`${s?.customers.student ?? 0} students · ${s?.customers.academic ?? 0} academic · ${s?.customers.nonAcademic ?? 0} non-academic`}
        />
        <StatCard label="Riders" value={String((s?.riders.approved ?? 0) + (s?.riders.pending ?? 0))} hint={`${s?.riders.approved ?? 0} approved · ${s?.riders.pending ?? 0} pending · ${s?.riders.online ?? 0} online`} />
        <StatCard
          label="Cafeterias"
          value={String((s?.cafeterias.approved ?? 0) + (s?.cafeterias.pending ?? 0))}
          hint={`${s?.cafeterias.approved ?? 0} approved · ${s?.cafeterias.pending ?? 0} pending`}
        />
        <StatCard
          label={`Orders · ${label}`}
          value={String(s?.orders.total ?? 0)}
          hint={`${s?.orders.completed ?? 0} completed · ${s?.orders.active ?? 0} active now · ${s?.orders.cancelled ?? 0} cancelled`}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Orders by hour · {label}</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {(s?.byHour ?? []).map((p) => (
              <div key={p.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${p.value} orders`}>
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
                <span className="text-[10px] text-muted">{p.hour}h</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Operational snapshot</h2>
          <p className="mt-3 text-3xl font-bold">{formatRs(s?.volume ?? 0)}</p>
          <p className="text-sm text-muted">Order volume · {label} · simulated receipts</p>
          <p className="mt-3 text-sm">
            {s?.activeDeliveries ?? 0} active deliveries · {live.length} live orders
          </p>
          {s && s.pendingApplications.courier + s.pendingApplications.cafeteria + s.pendingApplications.customer > 0 ? (
            <p className="note-warn mt-4 rounded-xl px-3 py-2 text-sm">
              {s.pendingApplications.courier} rider, {s.pendingApplications.cafeteria} cafeteria and {s.pendingApplications.customer} customer
              applications need review.
            </p>
          ) : (
            <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">All applications are reviewed.</p>
          )}
          <a href="#pending-approvals" className="mt-4 inline-block">
            <Button>Review pending approvals →</Button>
          </a>
        </Card>
        <Card>
          <h2 className="font-bold">Customer account breakdown</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Category</th>
                <th className="font-medium">Accounts</th>
                <th className="font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Student", s?.customers.student ?? 0],
                  ["Academic Staff", s?.customers.academic ?? 0],
                  ["Non-Academic Staff", s?.customers.nonAcademic ?? 0],
                  ["Total customers", s?.customers.total ?? 0],
                ] as const
              ).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-2">{k}</td>
                  <td>{v}</td>
                  <td>{pct(v, s?.customers.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/admin/users" className="mt-3 inline-block">
            <Button variant="soft" size="sm">
              Manage users
            </Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Operational alerts</h2>
          <Badge tone={settings?.orderingOpen === false ? "danger" : "soft"} className="mt-3">
            Ordering · {settings?.orderingOpen === false ? "Paused" : "Open"}
          </Badge>
          <p className="mt-2 text-sm text-muted">
            Delivery fee {formatRs(settings?.deliveryFee ?? 0)} · rider payout {formatRs(settings?.riderPayout ?? 0)} · cash until{" "}
            {settings?.cashCutoffHour ?? 11}:00
          </p>
          <Badge tone="warn" className="mt-3">
            Payments · Simulated
          </Badge>
          <p className="mt-2 text-sm text-muted">Sandbox provider setup is required before accepting real payments.</p>
          <Badge tone="warn" className="mt-3">
            Maps & matching · Schematic
          </Badge>
          <p className="mt-2 text-sm text-muted">Tracking is schematic; deliveries are matched in the demo workflow.</p>
          <Link href="/admin/logs" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              Open System Settings
            </Button>
          </Link>
        </Card>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <h2 className="font-bold">Live orders</h2>
        <table className="mt-3 w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-medium">Order</th>
              <th className="font-medium">Customer</th>
              <th className="font-medium">Vendor</th>
              <th className="font-medium">Total</th>
              <th className="font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {live.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-muted">
                  No live orders.
                </td>
              </tr>
            )}
            {live.slice(0, 8).map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="py-2 font-semibold">
                  {o.id} <span className="font-normal text-muted">· {formatWhen(o.createdAt)}</span>
                </td>
                <td>{o.customerName}</td>
                <td>{o.vendorName}</td>
                <td>{formatRs(o.total)}</td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4 overflow-x-auto">
        <h2 className="font-bold">Recent activity</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-medium">Time</th>
              <th className="font-medium">Event</th>
              <th className="font-medium">Level</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).slice(0, 6).map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-2 text-muted">{timeAgo(l.createdAt ?? l.at)}</td>
                <td>{l.msg}</td>
                <td className="uppercase text-xs">{l.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link href="/admin/logs" className="mt-3 inline-block text-sm font-semibold text-brand">
          Full activity log →
        </Link>
      </Card>
      <PendingApprovals />
    </div>
  );
}
