"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { acceptJob, listJobs } from "@/lib/api/courier";
import type { CourierJob } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import { useNotifyStore } from "@/lib/stores/notifications";
import { useEffect, useState } from "react";

export default function JobsPage() {
  const [jobs, setJobs] = useState<CourierJob[]>([]);
  const push = useNotifyStore((s) => s.push);

  useEffect(() => {
    listJobs().then(setJobs);
  }, []);

  async function take(id: string) {
    const updated = await acceptJob(id);
    setJobs((prev) => prev.map((j) => (j.id === id ? (updated ?? { ...j, status: "accepted" }) : j)));
    push("Job accepted", `Head to ${updated?.from ?? "pickup"}`);
  }

  return (
    <div className="space-y-4">
      <PageIntro crumb="Rider / Delivery Jobs" title="Eligible jobs on your loop." subtitle="Accept one assignment at a time. Conflicts are blocked in the live service." />
      {jobs.map((j) => (
        <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="soft">{j.status}</Badge>
            <p className="mt-2 font-semibold">
              {j.from} → {j.to}
            </p>
            <p className="text-sm text-muted">
              {j.distanceM} m · {j.items} item(s)
            </p>
          </div>
          <p className="font-bold text-brand">{formatRs(j.payout)}</p>
          {j.status === "open" ? (
            <Button onClick={() => take(j.id)}>Accept</Button>
          ) : (
            <Button variant="outline" disabled>
              {j.status}
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
