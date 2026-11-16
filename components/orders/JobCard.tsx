"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { JobView } from "@/lib/api/courier";
import { formatRs, timeAgo } from "@/lib/utils";

export function JobCard({
  job,
  busy,
  blocked,
  onAccept,
  onDecline,
}: {
  job: JobView;
  busy?: boolean;
  blocked?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card>
      <h2 className="text-lg font-bold">
        {job.orderId ?? job.id} · {job.order?.status === "ready" ? "Ready for Pickup" : "Being prepared"}
      </h2>
      <Badge tone="soft" className="mt-2">
        Eligible · {timeAgo(job.createdAt)}
      </Badge>
      <p className="mt-3 font-semibold">
        {job.from} → {job.to}
      </p>
      <p className="text-sm text-muted">
        {(job.distanceM / 1000).toFixed(1)} km schematic distance · {Math.max(6, Math.round(job.distanceM / 70))} min walking estimate ·{" "}
        {job.items} item(s){job.customerName ? ` · for ${job.customerName}` : ""}
      </p>
      <p className="mt-3 text-2xl font-bold">Earn {formatRs(job.payout)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onAccept} disabled={busy || blocked} title={blocked ? "Finish your active delivery first" : ""}>
          {busy ? "Accepting…" : "Accept job"}
        </Button>
        <Button variant="soft" onClick={onDecline} disabled={busy}>
          Decline
        </Button>
      </div>
      {blocked && <p className="mt-2 text-xs text-muted">Finish your active delivery before accepting another job.</p>}
    </Card>
  );
}
