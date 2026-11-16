"use client";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { listFavourites, listMenu, listVendors } from "@/lib/api/menu";
import { listNotifications } from "@/lib/api/notifications";
import { ACTIVE_STATUSES, listMyOrders } from "@/lib/api/orders";
import { getWallet } from "@/lib/api/wallet";
import { useApi } from "@/lib/hooks/useApi";
import { useAuthStore } from "@/lib/stores/auth";
import type { CustomerSubRole } from "@/lib/types";
import { formatRs, formatWhen, statusLabel, timeAgo } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useMounted } from "@/lib/hooks/useMounted";

const SUB_ROLES: { id: CustomerSubRole; label: string }[] = [
  { id: "student", label: "Student" },
  { id: "academic", label: "Academic Staff" },
  { id: "non-academic", label: "Non-Academic Staff" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function CustomerHome() {
  const user = useAuthStore((s) => s.user);
  const mounted = useMounted();
  const { data: wallet } = useApi(getWallet);
  const { data: orders } = useApi(listMyOrders);
  const { data: menu } = useApi(listMenu);
  const { data: vendors } = useApi(listVendors);
  const { data: favIds } = useApi(listFavourites);
  const { data: notes } = useApi(listNotifications);

  const first = mounted ? (user?.name?.split(" ")[0] ?? "there") : "";
  const list = orders ?? [];
  const live = list.find((o) => ACTIVE_STATUSES.includes(o.status) && !o.preOrder);
  const upcoming = list.find((o) => o.preOrder && ACTIVE_STATUSES.includes(o.status));
  const delivered = list.filter((o) => o.status === "delivered").length;
  const active = list.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const preorders = list.filter((o) => o.preOrder && ACTIVE_STATUSES.includes(o.status));
  const favs = (menu ?? []).filter((m) => (favIds ?? []).includes(m.id) || m.favourite).slice(0, 3);
  const vendorName = (id: string) => vendors?.find((v) => v.id === id)?.name ?? "";
  const imageFor = (o?: (typeof list)[number]) => o?.lines?.[0]?.image ?? menu?.[0]?.image;

  return (
    <div>
      <PageIntro crumb="Customer / Dashboard" title={`${greeting()}, ${first}.`} subtitle="Your lunch plans, all in one place." />
      <div className="mb-6 flex flex-wrap gap-2 text-xs font-semibold">
        {SUB_ROLES.map((r) => (
          <Badge key={r.id} tone={mounted && user?.customerSubRole === r.id ? "soft" : "muted"}>
            {r.label}
            {mounted && user?.customerSubRole === r.id ? " · your account" : ""}
          </Badge>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Wallet balance" value={formatRs(wallet?.balance ?? 0)} hint="Available for your next order" />
        <StatCard label="Your orders" value={String(list.length)} hint={`${delivered} delivered · ${active} active`} />
        <StatCard
          label="Upcoming pre-orders"
          value={String(preorders.length)}
          hint={preorders[0] ? `${preorders[0].scheduledFor} · ${preorders[0].slot}` : "Schedule from checkout"}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          {live ? (
            <>
              <h2 className="text-lg font-bold">
                {live.status === "out_for_delivery" ? "Your lunch is on its way" : live.status === "ready" ? "Your order is ready" : "Your order is in the kitchen"}
              </h2>
              <OrderStatusBadge status={live.status} className="mt-3" />
              <div className="mt-4 flex gap-3">
                {imageFor(live) && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image src={imageFor(live)!} alt="" fill className="object-cover" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{live.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                  <p className="text-sm text-muted">
                    {live.vendorName} · {formatRs(live.total)}
                  </p>
                  <p className="text-xs text-muted capitalize">
                    {live.id} · {live.fulfillment}
                    {live.fulfillment === "delivery" ? ` to ${live.destination}` : ""}
                  </p>
                </div>
              </div>
              <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">
                {statusLabel(live.status)} · placed {timeAgo(live.createdAt)}
                {live.courierName ? ` · Rider ${live.courierName}` : ""}
              </p>
              <Link href={`/customer/track?id=${live.id}`} className="mt-4 inline-block">
                <Button>Track order →</Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">Hungry?</h2>
              <p className="mt-2 text-sm text-muted">No active orders right now. Browse today&apos;s campus menu.</p>
              <Link href="/customer/explore" className="mt-4 inline-block">
                <Button>Explore food →</Button>
              </Link>
            </>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Tomorrow&apos;s lunch, sorted</h2>
          {upcoming ? (
            <>
              <Badge tone="soft" className="mt-3 capitalize">
                Pre-order · {upcoming.fulfillment}
              </Badge>
              <p className="mt-3 font-semibold">
                {upcoming.id} · {upcoming.scheduledFor}, {upcoming.slot}
              </p>
              <div className="mt-3 flex gap-3">
                {imageFor(upcoming) && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image src={imageFor(upcoming)!} alt="" fill className="object-cover" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{upcoming.items.map((i) => i.name).join(", ")}</p>
                  <p className="text-sm text-muted">
                    {upcoming.vendorName} · {formatRs(upcoming.total)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No pre-orders yet. Choose “Pre-order” at checkout to schedule a meal.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={upcoming ? "/customer/orders" : "/customer/pre-orders"}>
              <Button variant="soft" size="sm">
                Manage schedule
              </Button>
            </Link>
            <Link href="/customer/wallet">
              <Button variant="outline" size="sm">
                View wallet
              </Button>
            </Link>
          </div>
        </Card>
      </div>
      <Card className="mt-6 overflow-x-auto p-0">
        <div className="px-5 pt-5">
          <h2 className="text-lg font-bold">Recent orders</h2>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="font-medium">Fulfilment</th>
              <th className="font-medium">Total</th>
              <th className="font-medium">Status</th>
              <th className="pr-5 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-3 text-muted">
                  No orders yet.
                </td>
              </tr>
            )}
            {list.slice(0, 5).map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-5 py-3 font-semibold">{o.id}</td>
                <td className="capitalize">
                  {o.fulfillment} · {formatWhen(o.createdAt, o.placedAt)}
                </td>
                <td>{formatRs(o.total)}</td>
                <td className="capitalize">{o.status.replaceAll("_", " ")}</td>
                <td className="pr-5">
                  <Link href={`/customer/track?id=${o.id}`} className="text-brand">
                    RC-{o.id.slice(3)} ↗
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-5">
          <Link href="/customer/orders">
            <Button variant="soft" size="sm">
              My Orders & Pre-Orders
            </Button>
          </Link>
        </div>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Your favourites</h2>
          <div className="mt-4 space-y-4">
            {favs.map((m) => (
              <Link key={m.id} href={`/customer/food/${m.id}`} className="flex gap-3 hover:opacity-90">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Image src={m.image} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">
                    {vendorName(m.vendorId)} · {formatRs(m.price)} · {m.stock > 0 ? `${m.stock} available` : "Sold out"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/customer/explore" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              Explore Food
            </Button>
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Notifications & feedback</h2>
          {(notes ?? []).slice(0, 3).map((n) => (
            <div key={n.id} className="mt-3">
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-muted">
                {n.body} · {timeAgo(n.createdAt ?? n.at)}
              </p>
            </div>
          ))}
          {(notes ?? []).length === 0 && <p className="mt-3 text-sm text-muted">No notifications yet.</p>}
          <Link href="/customer/profile" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              Profile & feedback
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
