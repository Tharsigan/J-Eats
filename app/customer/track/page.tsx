import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MENU, ORDERS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

const STEPS = ["Placed", "Accepted", "Preparing", "Ready", "Out for delivery", "Delivered"];

export default function TrackPage() {
  const order = ORDERS[0];
  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Track Order"
        title="Follow every bite to your door."
        subtitle="Sample tracking for an active campus delivery."
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{order.id}</h2>
            <Badge tone="soft">Out for Delivery</Badge>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={MENU[0].image} alt="" fill className="object-cover" />
            </div>
            <div>
              <p className="font-semibold">{MENU[0].name}</p>
              <p className="text-sm text-muted">
                {order.fulfillment} · {order.pickupPoint} · {formatRs(order.total)}
              </p>
            </div>
          </div>
          <ol className="mt-6 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className={`h-3 w-3 rounded-full ${i <= 4 ? "bg-brand" : "bg-border"}`} />
                <span className={i <= 4 ? "font-semibold" : "text-muted"}>{s}</span>
              </li>
            ))}
          </ol>
          <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">8-minute walking estimate · Sample status, not live GPS.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Campus drop-off</h2>
          <p className="mt-2 text-sm text-muted">Library pickup zone · Inner ring road</p>
          <div className="mt-4 h-64 overflow-hidden rounded-2xl bg-surface-2">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <rect x="8" y="12" width="84" height="76" rx="8" className="fill-emerald-900/10 stroke-border" />
              <polyline points="38,42 58,62" className="stroke-brand" fill="none" strokeWidth="1.6" />
              <circle cx="38" cy="42" r="3" className="fill-brand" />
              <circle cx="58" cy="62" r="3" className="fill-cyan-500" />
            </svg>
          </div>
          <Link href="/customer/map" className="mt-4 inline-block">
            <Button variant="soft">Open campus map</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
