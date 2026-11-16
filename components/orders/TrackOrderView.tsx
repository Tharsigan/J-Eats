"use client";

import { CampusRoute } from "./CampusRoute";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cancelOrder, listMyOrders, ACTIVE_STATUSES } from "@/lib/api/orders";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { Order, OrderStatus } from "@/lib/types";
import { formatRs, formatWhen } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const DELIVERY_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "placed", label: "Placed" },
  { status: "accepted", label: "Accepted" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];
const PICKUP_STEPS = DELIVERY_STEPS.filter((s) => s.status !== "out_for_delivery").map((s) =>
  s.status === "ready" ? { ...s, label: "Ready for pickup" } : s.status === "delivered" ? { ...s, label: "Collected" } : s,
);

function eta(order: Order) {
  const map: Partial<Record<OrderStatus, string>> = {
    placed: "Waiting for the kitchen to accept · about 20 min",
    accepted: "Kitchen accepted · about 15 min",
    preparing: "Being prepared · about 10 min",
    ready: order.fulfillment === "pickup" ? "Ready at the counter — show your order number" : order.courierName ? `${order.courierName} is heading to the counter` : "Waiting for a rider to accept",
    out_for_delivery: "On the way · about 8 min walking",
    delivered: "Delivered. Enjoy your meal!",
    cancelled: order.cancelReason ? `Cancelled · ${order.cancelReason}` : "Cancelled",
  };
  return map[order.status] ?? "";
}

export function TrackOrderView() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("id");
  const { data: orders, loading } = useApi(listMyOrders);
  const { busy, error, message, run } = useAction();

  const list = orders ?? [];
  const active = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const order = (requested && list.find((o) => o.id === requested)) || active[0] || list[0];

  if (loading && !orders) return <Card className="text-sm text-muted">Loading your orders…</Card>;

  if (!order) {
    return (
      <div className="space-y-6">
        <PageIntro crumb="Customer / Track Order" title="Follow every bite to your door." subtitle="You have no orders yet." />
        <Card className="space-y-3">
          <p className="text-sm text-muted">Place an order and it will appear here with live status updates.</p>
          <Link href="/customer/explore">
            <Button>Explore food</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const steps = order.fulfillment === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const reached = new Map((order.timeline ?? []).map((t) => [t.status, t.at]));
  const currentIdx = steps.findIndex((s) => s.status === order.status);
  const progress = order.status === "out_for_delivery" ? 0.55 : order.status === "delivered" ? 1 : 0;
  const first = order.lines?.[0];

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Track Order"
        title="Follow every bite to your door."
        subtitle="Status updates live as the kitchen and rider progress your order."
      />
      {list.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Order</span>
          <select className="field max-w-xs" value={order.id} onChange={(e) => router.replace(`/customer/track?id=${e.target.value}`)}>
            {list.slice(0, 20).map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.status.replaceAll("_", " ")} · {formatWhen(o.createdAt)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{order.id}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="mt-4 flex gap-3">
            {first?.image && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Image src={first.image} alt="" fill className="object-cover" />
              </div>
            )}
            <div>
              <p className="font-semibold">{order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
              <p className="text-sm text-muted capitalize">
                {order.fulfillment} · {order.vendorName} {order.destination && order.fulfillment === "delivery" ? `→ ${order.destination}` : ""} ·{" "}
                {formatRs(order.total)}
              </p>
              <p className="text-xs text-muted">
                {order.preOrder && order.scheduledFor ? `Pre-order for ${order.scheduledFor} · ` : ""}
                {order.slot ? `Slot ${order.slot} · ` : ""}
                Paid by {order.payment} · {order.paymentStatus}
              </p>
            </div>
          </div>
          {order.status === "cancelled" ? (
            <p className="note-danger mt-6 rounded-xl px-3 py-2 text-sm">{eta(order)}</p>
          ) : (
            <ol className="mt-6 space-y-3">
              {steps.map((s, i) => {
                const done = i <= currentIdx;
                return (
                  <li key={s.status} className="flex items-center gap-3 text-sm">
                    <span className={`h-3 w-3 rounded-full ${done ? "bg-brand" : "bg-border"} ${i === currentIdx && order.status !== "delivered" ? "ring-4 ring-brand/20" : ""}`} />
                    <span className={done ? "font-semibold" : "text-muted"}>{s.label}</span>
                    {reached.get(s.status) && <span className="ml-auto text-xs text-muted">{formatWhen(reached.get(s.status))}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          {order.status !== "cancelled" && <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">{eta(order)}</p>}
          {order.courierName && order.fulfillment === "delivery" && (
            <p className="mt-3 text-sm">
              Rider · <span className="font-semibold">{order.courierName}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {["placed", "accepted"].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "cancel"}
                onClick={() => void run("cancel", () => cancelOrder(order.id, "Cancelled from tracking page"), "Order cancelled.")}
              >
                Cancel order
              </Button>
            )}
            {order.status === "delivered" && !order.reviewed && (
              <Link href={`/customer/profile?order=${order.id}`}>
                <Button size="sm">Rate this meal</Button>
              </Link>
            )}
            <Link href="/customer/orders">
              <Button size="sm" variant="soft">
                All orders
              </Button>
            </Link>
          </div>
          {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
          {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">{order.fulfillment === "delivery" ? "Campus drop-off" : "Campus pickup"}</h2>
          <p className="mt-2 text-sm text-muted">
            {order.fulfillment === "delivery" ? `${order.destination} · Inner ring road` : `${order.vendorName} counter`}
          </p>
          <div className="mt-4 h-64 overflow-hidden rounded-2xl bg-surface-2">
            <CampusRoute from={order.vendorName} to={order.fulfillment === "delivery" ? order.destination : order.vendorName} progress={progress} />
          </div>
          <p className="mt-2 text-xs text-muted">Schematic map · not live GPS.</p>
          <Link href="/customer/map" className="mt-4 inline-block">
            <Button variant="soft">Open campus map</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
