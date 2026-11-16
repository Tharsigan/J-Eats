"use client";

import { CampusRoute } from "@/components/orders/CampusRoute";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { completeJob, getActiveJob, pickUpJob } from "@/lib/api/courier";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { formatRs } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NavigatePage() {
  const router = useRouter();
  const { data: job, loading } = useApi(getActiveJob);
  const { busy, error, run } = useAction();

  if (loading && job === undefined) return <Card className="text-sm text-muted">Loading active delivery…</Card>;

  if (!job) {
    return (
      <div className="space-y-6">
        <PageIntro crumb="Rider / Active Delivery" title="No active delivery." subtitle="Accept a job to see your route here." />
        <Card className="space-y-3">
          <p className="text-sm text-muted">Open jobs appear as soon as a kitchen marks a delivery order ready.</p>
          <div className="flex gap-2">
            <Link href="/courier/jobs">
              <Button>Find delivery jobs</Button>
            </Link>
            <Link href="/courier/earnings">
              <Button variant="soft">View earnings</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const picked = job.status === "picked";
  const order = job.order;

  async function deliver() {
    const done = await run("deliver", () => completeJob(job!.id));
    if (done) router.push("/courier/earnings?delivered=1");
  }

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Rider / Active Delivery"
        title={`${job.orderId ?? job.id} is in your hands.`}
        subtitle="Schematic campus walk — live GPS is not connected in this demo."
      />
      <Card>
        <Badge tone="soft">{picked ? "Out for Delivery" : "Head to the counter"}</Badge>
        <p className="mt-3 font-semibold">
          Active: {job.from} → {job.to}
        </p>
        {order && (
          <p className="mt-1 text-sm text-muted">
            For {order.customerName} · {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
            {order.payment === "cash" ? ` · collect ${formatRs(order.total)} cash` : " · prepaid"}
          </p>
        )}
        {order?.notes && <p className="mt-1 text-sm font-semibold">Note: {order.notes}</p>}
        <ol className="mt-4 space-y-2 text-sm">
          <li className={picked ? "text-muted line-through" : "font-semibold"}>1. Collect {job.orderId} from the {job.from} counter.</li>
          <li className={picked ? "font-semibold" : "text-muted"}>2. Walk the inner ring road past the admin block.</li>
          <li className={picked ? "font-semibold" : "text-muted"}>3. Drop at the {job.to} pickup pin and hand over.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          {!picked ? (
            <Button
              onClick={() => void run("pick", () => pickUpJob(job.id))}
              disabled={busy === "pick" || order?.status !== "ready"}
              title={order?.status !== "ready" ? "Wait for the kitchen to mark it ready" : ""}
            >
              {busy === "pick" ? "Updating…" : order?.status === "ready" ? "Picked up from counter" : "Waiting for kitchen…"}
            </Button>
          ) : (
            <Button onClick={() => void deliver()} disabled={busy === "deliver"}>
              {busy === "deliver" ? "Confirming…" : `Mark delivered · earn ${formatRs(job.payout)}`}
            </Button>
          )}
        </div>
        {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
      </Card>
      <Card className="h-72 p-0">
        <CampusRoute from={job.from} to={job.to} progress={picked ? 0.5 : 0} />
      </Card>
      <Link href="/courier/earnings" className="text-sm font-semibold text-brand">
        View earnings after drop-off →
      </Link>
    </div>
  );
}
