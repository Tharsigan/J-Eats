import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ORDERS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";

export default function CafeteriaOrdersPage() {
  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Cafeteria / Orders & Pre-Orders"
        title="Tickets coming into the kitchen."
        subtitle="Incoming pre-orders and live tickets for Central Canteen."
      />
      {ORDERS.map((o) => (
        <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              {o.id} · {o.customerName}
            </p>
            <p className="text-sm text-muted">
              {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {o.payment}
            </p>
          </div>
          <Badge tone="soft" className="capitalize">
            {o.status.replaceAll("_", " ")}
          </Badge>
          <p className="font-semibold">{formatRs(o.total)}</p>
        </Card>
      ))}
    </div>
  );
}
