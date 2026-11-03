import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { INVENTORY, MENU, ORDERS, PEAK_HOURS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export default function CafeteriaHome() {
  const max = Math.max(...PEAK_HOURS.map((p) => p.value));
  const week = [
    { d: "Thu", v: 12500 },
    { d: "Fri", v: 14000 },
    { d: "Sat", v: 9800 },
    { d: "Sun", v: 10500 },
    { d: "Mon", v: 16200 },
    { d: "Tue", v: 17500 },
    { d: "Wed", v: 18300 },
  ];
  const wmax = Math.max(...week.map((x) => x.v));

  return (
    <div>
      <PageIntro
        crumb="Cafeteria / Dashboard & Analytics"
        title="A fresh view of your kitchen."
        subtitle="Central Canteen only · Approved operator · Sample campus activity"
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm">Today</Button>
        <Button size="sm" variant="outline">
          This week
        </Button>
        <Button size="sm" variant="outline">
          This month
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Meal sales today" value={formatRs(18300)} hint="Only Central Canteen · before fees" />
        <StatCard label="Completed orders" value="18" hint="22 total · 2 active · 2 cancelled" />
        <StatCard label="Average food rating" value="4.8 / 5" hint="Sample feedback · 124 reviews" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Peak times · Today</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {PEAK_HOURS.slice(1, 7).map((p) => (
              <div key={p.hour} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${(p.value / max) * 100}%` }} />
                <span className="text-[10px] text-muted">{p.hour}h</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Revenue trend · 08–14 Oct</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {week.map((p) => (
              <div key={p.d} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${(p.v / wmax) * 100}%` }} />
                <span className="text-[10px] text-muted">{p.d}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Today&apos;s bestsellers</h2>
          <div className="mt-4 space-y-4">
            {MENU.slice(0, 2).map((m) => (
              <div key={m.id} className="flex gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                  <Image src={m.image} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">
                    Central Canteen · {formatRs(m.price)} · {m.stock} available
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
              {INVENTORY.slice(0, 2).map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2">{i.name}</td>
                  <td>{i.stock}</td>
                  <td>{i.available ? "Available" : "Hidden"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">Inventory shown is sample stock, not live. Restock before busy lunch periods.</p>
          <Link href="/cafeteria/menu" className="mt-3 inline-block">
            <Button variant="soft" size="sm">
              Menu Management & Inventory
            </Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Order queue</h2>
          <Badge tone="soft" className="mt-2">
            {ORDERS.length} active sample orders
          </Badge>
          <ul className="mt-3 space-y-2 text-sm">
            {ORDERS.map((o) => (
              <li key={o.id}>
                {o.id} · {o.items[0].name} · {o.fulfillment} · {o.status.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
          <Link href="/cafeteria/orders" className="mt-4 inline-block">
            <Button>Open orders</Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Ratings & feedback</h2>
          <p className="mt-2 text-sm">Food 4.8 · Service 4.7 · Sample averages</p>
          <p className="mt-3 text-sm text-muted">“Generous portions and quick counter pickup.”</p>
        </Card>
      </div>
    </div>
  );
}
