"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ORDERS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";
import { useState } from "react";

const FILTERS = ["All orders", "Active", "Pre-Orders", "Completed", "Cancelled"];

const HISTORY = [
  ...ORDERS.map((o) => ({
    id: o.id,
    date: o.placedAt,
    fulfill: o.fulfillment,
    meal: o.items.map((i) => i.name).join(", "),
    total: o.total,
    status: o.status.replaceAll("_", " "),
    pay: `Paid sample · RC-${o.id.slice(3)}`,
  })),
  {
    id: "JE-1043",
    date: "15 Oct",
    fulfill: "Pickup · 12:30",
    meal: "Kottu",
    total: 1100,
    status: "Scheduled",
    pay: "Pending payment",
  },
  {
    id: "JE-1036",
    date: "10 Oct",
    fulfill: "Delivery",
    meal: "Kottu",
    total: 1200,
    status: "Delivered",
    pay: "Paid · RC-1036",
  },
];

export default function OrdersPage() {
  const [filter, setFilter] = useState("All orders");
  const [keep, setKeep] = useState(true);

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / My Orders & Pre-Orders"
        title="Every bite, accounted for."
        subtitle="Your order history and upcoming campus meals."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "soft" : "outline"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="soft">
          Last 30 days
        </Button>
        <Button size="sm" variant="outline">
          Download receipts
        </Button>
      </div>
      <Card className="overflow-x-auto p-0">
        <h2 className="px-5 pt-5 text-lg font-bold">Order history</h2>
        <table className="mt-3 w-full min-w-[720px] text-left text-sm">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Reference / date</th>
              <th className="font-medium">Fulfilment</th>
              <th className="font-medium">Meal / total</th>
              <th className="font-medium">Order status</th>
              <th className="pr-5 font-medium">Payment / receipt</th>
            </tr>
          </thead>
          <tbody>
            {HISTORY.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-5 py-3 font-semibold">
                  {row.id} · {row.date}
                </td>
                <td className="capitalize">{row.fulfill}</td>
                <td>
                  {row.meal} · {formatRs(row.total)}
                </td>
                <td>{row.status}</td>
                <td className="pr-5">{row.pay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Upcoming · JE-1043</h2>
          <Badge tone="soft" className="mt-3">
            Scheduled · Pickup
          </Badge>
          <p className="mt-3 font-semibold">15 Oct 2026 · 12:30 PM</p>
          <p className="text-sm text-muted">Central Canteen pickup point · 1 Cheesy Chicken Kottu</p>
          <p className="mt-4 text-sm font-semibold">Reschedule to</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm">Confirm reschedule</Button>
            <Button size="sm" variant="outline" disabled>
              12:00 · Unavailable
            </Button>
            <Button size="sm" variant="outline" disabled>
              14 Oct · Past
            </Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Cancel pre-order · confirmation state</h2>
          <p className="mt-2 text-sm">Cancel JE-1043 scheduled for tomorrow?</p>
          <label className="mt-3 block text-sm font-semibold">
            Cancellation reason
            <input className="field mt-1" defaultValue="My schedule changed" />
          </label>
          <p className="note-warn mt-3 rounded-xl px-3 py-2 text-sm">
            This example has no charge yet. Paid cancellations follow the cafeteria&apos;s refund policy.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="soft" onClick={() => setKeep(true)}>
              Keep pre-order
            </Button>
            <Button onClick={() => setKeep(false)}>Confirm cancellation</Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            {keep ? "Pre-order kept." : "Sample cancelled state: JE-1032 · Refund RF-1032 completed."}
          </p>
        </Card>
      </div>
    </div>
  );
}
