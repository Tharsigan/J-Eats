"use client";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listSlots } from "@/lib/api/menu";
import { ACTIVE_STATUSES, cancelOrder, getReceipt, listMyOrders, rescheduleOrder } from "@/lib/api/orders";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { Order } from "@/lib/types";
import { downloadText, formatRs, formatWhen } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

const FILTERS = ["All orders", "Active", "Pre-Orders", "Completed", "Cancelled"] as const;
type Filter = (typeof FILTERS)[number];

function matches(o: Order, f: Filter) {
  if (f === "Active") return ACTIVE_STATUSES.includes(o.status);
  if (f === "Pre-Orders") return Boolean(o.preOrder);
  if (f === "Completed") return o.status === "delivered";
  if (f === "Cancelled") return o.status === "cancelled";
  return true;
}

export default function OrdersPage() {
  const { data, loading } = useApi(listMyOrders);
  const [filter, setFilter] = useState<Filter>("All orders");
  const [last30, setLast30] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("My schedule changed");
  const [confirming, setConfirming] = useState(false);
  const [now] = useState(() => Date.now());
  const { busy, error, message, run } = useAction();

  const orders = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const from = now - 30 * 86_400_000;
    return orders.filter((o) => matches(o, filter) && (!last30 || new Date(o.createdAt ?? 0).getTime() >= from));
  }, [orders, filter, last30, now]);

  const upcoming = orders.filter((o) => o.status === "placed" || o.status === "accepted");
  const selected = upcoming.find((o) => o.id === selectedId) ?? upcoming.find((o) => o.preOrder) ?? upcoming[0];
  const { data: slots } = useApi(() => listSlots(selected?.scheduledFor), [selected?.scheduledFor]);

  async function downloadReceipts() {
    const paid = rows.filter((o) => o.status !== "cancelled");
    if (!paid.length) return;
    const texts = await Promise.all(paid.map((o) => getReceipt(o.id)));
    downloadText(`jeats-receipts-${new Date().toISOString().slice(0, 10)}.txt`, texts.join("\n\n"));
  }

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
            {f} · {orders.filter((o) => matches(o, f)).length}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={last30 ? "soft" : "outline"} onClick={() => setLast30((v) => !v)}>
          {last30 ? "Last 30 days" : "All time"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void downloadReceipts()} disabled={!rows.length}>
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
            {loading && !data && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-muted">
                  Loading orders…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-muted">
                  No orders match this filter.{" "}
                  <Link href="/customer/explore" className="font-semibold text-brand">
                    Order something →
                  </Link>
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-5 py-3 font-semibold">
                  <Link href={`/customer/track?id=${o.id}`} className="hover:text-brand">
                    {o.id}
                  </Link>{" "}
                  · <span className="font-normal text-muted">{formatWhen(o.createdAt, o.placedAt)}</span>
                </td>
                <td className="capitalize">
                  {o.fulfillment}
                  {o.slot ? ` · ${o.slot}` : ""}
                  {o.preOrder ? " · pre-order" : ""}
                </td>
                <td>
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {formatRs(o.total)}
                </td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="pr-5">
                  {o.status === "cancelled" ? (
                    <span className="text-muted">{o.paymentStatus === "refunded" ? "Refunded" : "No charge"}</span>
                  ) : (
                    <button
                      type="button"
                      className="text-brand hover:underline"
                      onClick={() => void getReceipt(o.id).then((t) => downloadText(`receipt-${o.id}.txt`, t))}
                    >
                      {o.paymentStatus === "pending" ? "Pay on pickup" : "Paid"} · RC-{o.id.slice(3)} ↓
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Upcoming · {selected.id}</h2>
                {upcoming.length > 1 && (
                  <select
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                    value={selected.id}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setNewSlot(null);
                      setConfirming(false);
                    }}
                  >
                    {upcoming.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <Badge tone="soft" className="mt-3 capitalize">
                {selected.preOrder ? "Scheduled" : selected.status} · {selected.fulfillment}
              </Badge>
              <p className="mt-3 font-semibold">
                {selected.scheduledFor ?? "Today"} · {selected.slot ?? "ASAP"}
              </p>
              <p className="text-sm text-muted">
                {selected.vendorName} · {selected.items.map((i) => `${i.qty} ${i.name}`).join(", ")}
              </p>
              {selected.status === "placed" ? (
                <>
                  <p className="mt-4 text-sm font-semibold">Reschedule to</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(slots ?? []).map((s) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant={(newSlot ?? selected.slot) === s.id ? "primary" : "outline"}
                        disabled={!s.available}
                        onClick={() => setNewSlot(s.id)}
                      >
                        {s.label}
                        {s.available ? "" : ` · ${s.hint}`}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={!newSlot || newSlot === selected.slot || busy === "reschedule"}
                    onClick={() =>
                      void run("reschedule", () => rescheduleOrder(selected.id, newSlot!), `Rescheduled ${selected.id} to ${newSlot}.`).then(() =>
                        setNewSlot(null),
                      )
                    }
                  >
                    Confirm reschedule
                  </Button>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">The kitchen accepted this order, so the time slot is locked.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">No upcoming orders</h2>
              <p className="mt-2 text-sm text-muted">Schedule tomorrow&apos;s lunch from checkout with Pre-order.</p>
              <Link href="/customer/explore" className="mt-4 inline-block">
                <Button size="sm">Explore food</Button>
              </Link>
            </>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Cancel {selected?.preOrder ? "pre-order" : "order"}</h2>
          {selected ? (
            <>
              <p className="mt-2 text-sm">
                Cancel {selected.id} scheduled for {selected.scheduledFor ?? "today"} {selected.slot ?? ""}?
              </p>
              <label className="mt-3 block text-sm font-semibold">
                Cancellation reason
                <input className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <p className="note-warn mt-3 rounded-xl px-3 py-2 text-sm">
                {selected.paymentStatus === "paid"
                  ? `${formatRs(selected.total)} will be refunded to your ${selected.payment === "wallet" ? "wallet" : "card (simulated)"}.`
                  : "No charge has been made yet."}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="soft" onClick={() => setConfirming(false)}>
                  Keep {selected.preOrder ? "pre-order" : "order"}
                </Button>
                {confirming ? (
                  <Button
                    variant="danger"
                    disabled={busy === "cancel"}
                    onClick={() =>
                      void run("cancel", () => cancelOrder(selected.id, reason), (o) =>
                        `${o.id} cancelled.${o.paymentStatus === "refunded" ? ` Refund of ${formatRs(o.total)} completed.` : ""}`,
                      ).then(() => setConfirming(false))
                    }
                  >
                    Yes, cancel it
                  </Button>
                ) : (
                  <Button onClick={() => setConfirming(true)}>Confirm cancellation</Button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Orders can be cancelled until the kitchen starts preparing them.</p>
          )}
          {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
          {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
        </Card>
      </div>
    </div>
  );
}
