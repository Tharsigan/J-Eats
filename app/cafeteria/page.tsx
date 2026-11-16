"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getMyVendor, getVendorStats, incomingOrders, listMyMenu, updateMyVendor, type StatsRange } from "@/lib/api/cafeteria";
import { listReviews } from "@/lib/api/menu";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { formatRs, timeAgo } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

function Bars({ data, label }: { data: { k: string; v: number }[]; label: (v: number) => string }) {
  const max = Math.max(1, ...data.map((p) => p.v));
  return (
    <div className="mt-4 flex h-40 items-end gap-2">
      {data.map((p) => (
        <div key={p.k} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${p.k}: ${label(p.v)}`}>
          <span className="text-[10px] text-muted opacity-0 transition group-hover:opacity-100">{label(p.v)}</span>
          <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(2, (p.v / max) * 100)}%` }} />
          <span className="text-[10px] text-muted">{p.k}</span>
        </div>
      ))}
    </div>
  );
}

export default function CafeteriaHome() {
  const [range, setRange] = useState<StatsRange>("today");
  const { data: vendor } = useApi(getMyVendor);
  const { data: stats } = useApi(() => getVendorStats(range), [range]);
  const { data: menu } = useApi(listMyMenu);
  const { data: orders } = useApi(incomingOrders);
  const { data: reviews } = useApi(() => listReviews(), []);
  const toggle = useAction();

  const itemIds = new Set((menu ?? []).map((m) => m.id));
  const myReviews = (reviews ?? []).filter((r) => itemIds.has(r.itemId));
  const live = (orders ?? []).filter((o) => ["placed", "accepted", "preparing", "ready", "out_for_delivery"].includes(o.status));
  const lowStock = [...(menu ?? [])].sort((a, b) => a.stock - b.stock).slice(0, 4);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label.toLowerCase();

  return (
    <div>
      <PageIntro
        crumb="Cafeteria / Dashboard & Analytics"
        title="A fresh view of your kitchen."
        subtitle={`${vendor?.name ?? "Your cafeteria"} only · Approved operator · Live demo activity`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Button key={r.id} size="sm" variant={range === r.id ? "primary" : "outline"} onClick={() => setRange(r.id)}>
            {r.label}
          </Button>
        ))}
        {vendor && (
          <Button
            size="sm"
            variant={vendor.openNow ? "soft" : "danger"}
            className="ml-auto"
            disabled={toggle.busy === "open"}
            onClick={() => void toggle.run("open", () => updateMyVendor({ openNow: !vendor.openNow }))}
          >
            {vendor.openNow ? "Open · tap to close" : "Closed · tap to open"}
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={`Meal sales · ${rangeLabel}`} value={formatRs(stats?.sales ?? 0)} hint={`Only ${vendor?.name ?? "your stall"} · before fees`} />
        <StatCard
          label="Completed orders"
          value={String(stats?.completed ?? 0)}
          hint={`${stats?.total ?? 0} total · ${stats?.active ?? 0} active now · ${stats?.cancelled ?? 0} cancelled`}
        />
        <StatCard
          label="Average food rating"
          value={stats?.reviewCount ? `${stats.rating.toFixed(1)} / 5` : "—"}
          hint={`${stats?.reviewCount ?? 0} reviews`}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Peak times · {rangeLabel}</h2>
          <Bars data={(stats?.byHour ?? []).map((p) => ({ k: `${p.hour}h`, v: p.value }))} label={(v) => `${v} orders`} />
        </Card>
        <Card>
          <h2 className="font-bold">Revenue trend · last 7 days</h2>
          <Bars data={(stats?.byDay ?? []).map((p) => ({ k: p.d, v: p.v }))} label={(v) => formatRs(v)} />
        </Card>
        <Card>
          <h2 className="font-bold">Bestsellers · {rangeLabel}</h2>
          <div className="mt-4 space-y-4">
            {(stats?.bestsellers ?? []).length === 0 && <p className="text-sm text-muted">No sales in this period yet.</p>}
            {(stats?.bestsellers ?? []).map((m) => (
              <div key={m.itemId} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Image src={m.image} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">
                    {m.qty} sold · {formatRs(m.price)} · {m.stock} available
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Stock & operational alerts</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Item</th>
                <th className="font-medium">Stock</th>
                <th className="font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2">{i.name}</td>
                  <td className={i.stock === 0 ? "font-semibold text-danger" : i.stock <= 5 ? "font-semibold text-amber-600" : ""}>{i.stock}</td>
                  <td>{!i.available ? "Hidden" : i.stock === 0 ? "Sold out" : "Available"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lowStock.some((i) => i.stock <= 5) && (
            <p className="note-warn mt-3 rounded-xl px-3 py-2 text-sm">Some items are low. Restock before the lunch rush.</p>
          )}
          <Link href="/cafeteria/menu" className="mt-3 inline-block">
            <Button variant="soft" size="sm">
              Menu Management & Inventory
            </Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Order queue</h2>
          <Badge tone={live.some((o) => o.status === "placed") ? "warn" : "soft"} className="mt-2">
            {live.length} active orders · {live.filter((o) => o.status === "placed").length} new
          </Badge>
          <ul className="mt-3 space-y-2 text-sm">
            {live.length === 0 && <li className="text-muted">No active tickets.</li>}
            {live.slice(0, 6).map((o) => (
              <li key={o.id}>
                <span className="font-semibold">{o.id}</span> · {o.items[0]?.name}
                {o.items.length > 1 ? ` +${o.items.length - 1}` : ""} · {o.fulfillment} · {o.status.replaceAll("_", " ")} ·{" "}
                <span className="text-muted">{timeAgo(o.createdAt)}</span>
              </li>
            ))}
          </ul>
          <Link href="/cafeteria/orders" className="mt-4 inline-block">
            <Button>Open orders</Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Ratings & feedback</h2>
          <p className="mt-2 text-sm">
            {stats?.reviewCount ? `Food ${stats.rating.toFixed(1)} · ${stats.reviewCount} reviews` : "No reviews yet"}
          </p>
          {myReviews.slice(0, 3).map((r) => (
            <p key={r.id} className="mt-3 text-sm text-muted">
              “{r.body}” — {r.author}, {r.rating}★
            </p>
          ))}
        </Card>
      </div>
    </div>
  );
}
