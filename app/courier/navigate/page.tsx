import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MAP_POINTS } from "@/lib/mock-data/campus";
import Link from "next/link";

export default function NavigatePage() {
  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Rider / Active Delivery"
        title="JE-1042 is in your hands."
        subtitle="Schematic campus walk — live GPS is not connected in this demo."
      />
      <Card>
        <Badge tone="soft">Out for Delivery</Badge>
        <p className="mt-3 font-semibold">Active: Central Canteen → Library steps</p>
        <ol className="mt-4 space-y-2 text-sm text-muted">
          <li>1. Collect from Central Canteen counter B.</li>
          <li>2. Walk the inner ring road past the admin block.</li>
          <li>3. Drop at Library steps pickup pin.</li>
        </ol>
        <Button className="mt-4">Mark delivered</Button>
      </Card>
      <Card className="h-72 p-0">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polyline points="38,42 58,62" className="stroke-brand" fill="none" strokeWidth="1.5" strokeDasharray="2 1" />
          {MAP_POINTS.slice(0, 4).map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r="2" className={p.kind === "cafeteria" ? "fill-brand" : "fill-cyan-400"} />
          ))}
        </svg>
      </Card>
      <Link href="/courier/earnings" className="text-sm font-semibold text-brand">
        View earnings after drop-off →
      </Link>
    </div>
  );
}
