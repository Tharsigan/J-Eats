"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MENU, ORDERS } from "@/lib/mock-data/campus";
import { useAuthStore } from "@/lib/stores/auth";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export default function CustomerHome() {
  const user = useAuthStore((s) => s.user);
  const balance = useWalletStore((s) => s.balance);
  const first = user?.name?.split(" ")[0] ?? "Mira";
  const favs = MENU.filter((m) => m.favourite || m.id === "m_burger").slice(0, 2);
  const live = ORDERS[0];

  return (
    <div>
      <PageIntro
        crumb="Customer / Dashboard"
        title={`Good afternoon, ${first}.`}
        subtitle="Your lunch plans, all in one place."
      />
      <div className="mb-6 flex flex-wrap gap-2 text-xs font-semibold">
        <Badge tone="soft">Student · selected</Badge>
        <Badge tone="muted">Academic Staff · identity example</Badge>
        <Badge tone="muted">Non-Academic Staff · identity example</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Wallet balance" value={formatRs(balance)} hint="Before sample order payment" />
        <StatCard label="Your orders" value="12" hint="10 delivered · 1 active · 1 upcoming" />
        <StatCard label="Upcoming pre-orders" value="1" hint="Tomorrow · 12:30 PM" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Your lunch is on its way</h2>
          <Badge tone="soft" className="mt-3">
            {live.id} · Out for Delivery
          </Badge>
          <div className="mt-4 flex gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={MENU[0].image} alt="" fill className="object-cover" />
            </div>
            <div>
              <p className="font-semibold">{MENU[0].name}</p>
              <p className="text-sm text-muted">Central Canteen · {formatRs(MENU[0].price)}</p>
              <p className="text-xs text-muted">18 available · Sample stock</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">2 meals · Rs. 1,800 · Delivery to Library pickup zone</p>
          <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">8-minute walking estimate · Sample status, not live tracking</p>
          <Link href="/customer/track" className="mt-4 inline-block">
            <Button>
              Track order →
            </Button>
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Tomorrow&apos;s lunch, sorted</h2>
          <Badge tone="soft" className="mt-3">
            Pre-order · Pickup
          </Badge>
          <p className="mt-3 font-semibold">JE-1043 · 15 Oct, 12:30 PM</p>
          <div className="mt-3 flex gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={MENU[1].image} alt="" fill className="object-cover" />
            </div>
            <div>
              <p className="font-semibold">{MENU[1].name}</p>
              <p className="text-sm text-muted">Central Canteen · {formatRs(MENU[1].price)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/customer/pre-orders">
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
            {ORDERS.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-5 py-3 font-semibold">{o.id}</td>
                <td className="capitalize">{o.fulfillment} · {o.placedAt}</td>
                <td>{formatRs(o.total)}</td>
                <td className="capitalize">{o.status.replaceAll("_", " ")}</td>
                <td className="pr-5 text-brand">RC-{o.id.slice(3)} ↗</td>
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
              <div key={m.id} className="flex gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                  <Image src={m.image} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">
                    {formatRs(m.price)} · {m.stock} available
                  </p>
                </div>
              </div>
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
          <p className="mt-3 font-semibold">Your rider has collected {live.id}</p>
          <p className="text-sm text-muted">Today, 12:12 PM · Sample notification</p>
          <p className="mt-4 font-semibold">Pre-order reminder</p>
          <p className="text-sm text-muted">Tomorrow at 12:30 PM · Central Canteen pickup</p>
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
