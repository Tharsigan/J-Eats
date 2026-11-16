"use client";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { advanceOrder, incomingOrders, rejectOrder } from "@/lib/api/cafeteria";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { Order, OrderStatus } from "@/lib/types";
import { formatRs, formatWhen, timeAgo } from "@/lib/utils";
import { useState } from "react";

const TABS: { id: string; label: string; statuses: OrderStatus[] }[] = [
  { id: "new", label: "New", statuses: ["placed"] },
  { id: "kitchen", label: "In kitchen", statuses: ["accepted", "preparing"] },
  { id: "ready", label: "Ready / out", statuses: ["ready", "out_for_delivery"] },
  { id: "done", label: "Completed", statuses: ["delivered"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
  { id: "all", label: "All", statuses: [] },
];

function primaryAction(o: Order): string | null {
  if (o.status === "placed") return "Accept order";
  if (o.status === "accepted") return "Start preparing";
  if (o.status === "preparing") return "Mark ready";
  if (o.status === "ready" && o.fulfillment === "pickup") return "Mark collected";
  return null;
}

export default function CafeteriaOrdersPage() {
  const { data, loading } = useApi(incomingOrders);
  const [tab, setTab] = useState("new");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("Item sold out");
  const { busy, error, message, run } = useAction();

  const orders = data ?? [];
  const current = TABS.find((t) => t.id === tab)!;
  const rows = current.statuses.length ? orders.filter((o) => current.statuses.includes(o.status)) : orders;

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Cafeteria / Orders & Pre-Orders"
        title="Tickets coming into the kitchen."
        subtitle="Accept, prepare and hand over orders. Customers and riders are notified at each step."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = t.statuses.length ? orders.filter((o) => t.statuses.includes(o.status)).length : orders.length;
          return (
            <Button key={t.id} size="sm" variant={tab === t.id ? "soft" : "outline"} onClick={() => setTab(t.id)}>
              {t.label} · {n}
            </Button>
          );
        })}
      </div>
      {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
      {loading && !data && <Card className="text-sm text-muted">Loading tickets…</Card>}
      {!loading && rows.length === 0 && <Card className="text-sm text-muted">No orders in this lane.</Card>}
      {rows.map((o) => {
        const action = primaryAction(o);
        return (
          <Card key={o.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {o.id} · {o.customerName}
                  {o.preOrder && <span className="ml-2 text-xs font-normal text-brand">Pre-order</span>}
                </p>
                <p className="text-sm text-muted">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {o.payment}
                  {o.paymentStatus === "pending" ? " (collect cash)" : ""}
                </p>
                <p className="text-xs text-muted capitalize">
                  {o.fulfillment}
                  {o.fulfillment === "delivery" ? ` → ${o.destination}` : ""} · {o.preOrder ? `for ${o.scheduledFor} ` : ""}
                  slot {o.slot ?? "ASAP"} · placed {formatWhen(o.createdAt, o.placedAt)} ({timeAgo(o.createdAt)})
                </p>
                {o.lines?.some((l) => l.spice || l.notes) && (
                  <p className="text-xs text-muted">
                    {o.lines.map((l) => `${l.name}: ${l.spice ?? "medium"} spice${l.notes ? ` · “${l.notes}”` : ""}`).join(" | ")}
                  </p>
                )}
                {o.notes && <p className="text-xs font-semibold">Note: {o.notes}</p>}
                {o.cancelReason && <p className="text-xs text-danger">Cancelled: {o.cancelReason}</p>}
              </div>
              <div className="text-right">
                <OrderStatusBadge status={o.status} />
                <p className="mt-2 font-semibold">{formatRs(o.total)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {action && (
                <Button
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() => void run(o.id, () => advanceOrder(o.id), (r) => `${r.id} → ${r.status === "delivered" ? "collected" : r.status.replaceAll("_", " ")}.`)}
                >
                  {busy === o.id ? "Updating…" : action}
                </Button>
              )}
              {o.status === "ready" && o.fulfillment === "delivery" && (
                <span className="text-sm text-muted">{o.courierName ? `Rider ${o.courierName} is on the way` : "Waiting for a rider to accept…"}</span>
              )}
              {o.status === "out_for_delivery" && <span className="text-sm text-muted">Out with {o.courierName}</span>}
              {["placed", "accepted", "preparing"].includes(o.status) &&
                (rejecting === o.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <input className="field h-9 w-56" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy === `r${o.id}`}
                      onClick={() =>
                        void run(`r${o.id}`, () => rejectOrder(o.id, reason), `${o.id} rejected and refunded.`).then(() => setRejecting(null))
                      }
                    >
                      Confirm reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setRejecting(o.id)}>
                    Reject
                  </Button>
                ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
