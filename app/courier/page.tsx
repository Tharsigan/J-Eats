"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { acceptJob, listJobs } from "@/lib/api/courier";
import { JOBS } from "@/lib/mock-data/campus";
import { useAuthStore } from "@/lib/stores/auth";
import { useNotifyStore } from "@/lib/stores/notifications";
import type { CourierJob } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CourierHome() {
  const user = useAuthStore((s) => s.user);
  const push = useNotifyStore((s) => s.push);
  const [jobs, setJobs] = useState<CourierJob[]>(JOBS);
  const first = user?.name?.split(" ")[0] ?? "Ari";

  useEffect(() => {
    listJobs().then(setJobs);
  }, []);

  async function take(id: string) {
    const updated = await acceptJob(id);
    setJobs((prev) => prev.map((j) => (j.id === id ? (updated ?? { ...j, status: "accepted" }) : j)));
    push("Job accepted", `Head to ${updated?.from ?? "pickup"}`);
  }

  return (
    <div>
      <PageIntro
        crumb="Rider / Dashboard & Delivery Jobs"
        title={`Ready for a campus run, ${first}?`}
        subtitle="Approved rider · Eligible sample jobs near your campus pickup zone."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="soft">Verification approved</Badge>
        <Button size="sm">Online · selected</Button>
        <Button size="sm" variant="outline">
          Offline
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today's earnings" value={formatRs(500)} hint="5 completed deliveries × Rs. 100" />
        <StatCard label="Active delivery" value="1" hint="JE-1042 · Rs. 100 on completion" />
        <StatCard label="This week" value={formatRs(2400)} hint="24 completed sample deliveries" />
      </div>
      <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">
        Matching explanation: sample pickup proximity + Online availability + approved verification. Real delivery matching is not connected.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {jobs
          .filter((j) => j.status === "open")
          .map((j) => (
            <Card key={j.id}>
              <h2 className="text-lg font-bold">
                {j.id.replace("job_", "JE-104")} · Ready for Pickup
              </h2>
              <Badge tone="soft" className="mt-2">
                Eligible · sample match
              </Badge>
              <p className="mt-3 font-semibold">
                {j.from} → {j.to}
              </p>
              <p className="text-sm text-muted">
                {(j.distanceM / 1000).toFixed(1)} km schematic distance · {Math.max(6, Math.round(j.distanceM / 70))} min walking estimate
              </p>
              <p className="mt-3 text-2xl font-bold">Earn {formatRs(j.payout)}</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => take(j.id)}>Accept job</Button>
                <Button variant="soft">Decline</Button>
              </div>
            </Card>
          ))}
        <Card>
          <h2 className="text-lg font-bold">Active delivery · JE-1042</h2>
          <Badge tone="soft" className="mt-2">
            Out for Delivery
          </Badge>
          <p className="mt-3 font-semibold">Central Canteen → Library pickup zone</p>
          <p className="text-sm text-muted">8 min walking estimate · Rs. 100 on completion</p>
          <Link href="/courier/navigate" className="mt-4 inline-block">
            <Button>Open active delivery →</Button>
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">History & notifications</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Reference</th>
                <th className="font-medium">Outcome</th>
                <th className="font-medium">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["JE-1040", "Delivered · 11:40 AM", "Rs. 100"],
                ["JE-1039", "Delivered · 11:10 AM", "Rs. 100"],
                ["JE-1044", "Declined · not active", "Rs. 0"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-border">
                  <td className="py-2 font-semibold">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
