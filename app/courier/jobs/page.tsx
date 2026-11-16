"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { acceptJob, declineJob, getOnline, listJobs } from "@/lib/api/courier";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { useAuthStore } from "@/lib/stores/auth";
import { formatRs, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TABS = ["Open", "Mine", "Completed"] as const;

export default function JobsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: jobs, loading } = useApi(listJobs);
  const { data: online } = useApi(getOnline);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Open");
  const { busy, error, message, run } = useAction();

  const all = jobs ?? [];
  const mine = all.filter((j) => j.courierId === user?.id);
  const hasActive = mine.some((j) => j.status === "accepted" || j.status === "picked");
  const rows =
    tab === "Open"
      ? all.filter((j) => j.status === "open")
      : tab === "Mine"
        ? mine.filter((j) => j.status === "accepted" || j.status === "picked")
        : mine.filter((j) => j.status === "delivered" || j.status === "cancelled");

  async function take(id: string) {
    const job = await run(id, () => acceptJob(id), "Job accepted.");
    if (job) router.push("/courier/navigate");
  }

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Rider / Delivery Jobs"
        title="Eligible jobs on your loop."
        subtitle="Accept one assignment at a time. Jobs taken by another rider disappear automatically."
      />
      {online === false && (
        <p className="note-warn rounded-xl px-3 py-2 text-sm">
          You&apos;re offline, so no new jobs are shown.{" "}
          <Link href="/courier" className="font-semibold">
            Go online →
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "soft" : "outline"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
      {loading && !jobs && <Card className="text-sm text-muted">Loading jobs…</Card>}
      {!loading && rows.length === 0 && <Card className="text-sm text-muted">Nothing here yet.</Card>}
      {rows.map((j) => (
        <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone={j.status === "open" ? "soft" : j.status === "delivered" ? "brand" : j.status === "cancelled" ? "danger" : "warn"}>
              {j.status === "picked" ? "out for delivery" : j.status}
            </Badge>
            <p className="mt-2 font-semibold">
              {j.orderId ?? j.id} · {j.from} → {j.to}
            </p>
            <p className="text-sm text-muted">
              {j.distanceM} m · {j.items} item(s) · {timeAgo(j.completedAt ?? j.createdAt)}
            </p>
          </div>
          <p className="font-bold text-brand">{formatRs(j.payout)}</p>
          {j.status === "open" ? (
            <div className="flex gap-2">
              <Button onClick={() => void take(j.id)} disabled={busy === j.id || hasActive} title={hasActive ? "Finish your active delivery first" : ""}>
                Accept
              </Button>
              <Button variant="soft" onClick={() => void run(`d${j.id}`, () => declineJob(j.id), "Job declined.")}>
                Decline
              </Button>
            </div>
          ) : j.status === "accepted" || j.status === "picked" ? (
            <Link href="/courier/navigate">
              <Button>Continue →</Button>
            </Link>
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
