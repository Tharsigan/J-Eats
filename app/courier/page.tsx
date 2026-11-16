"use client";

import { JobCard } from "@/components/orders/JobCard";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { acceptJob, declineJob, getOnline, getRiderStats, listJobs, setOnline } from "@/lib/api/courier";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { useAuthStore } from "@/lib/stores/auth";
import { formatRs, formatWhen } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMounted } from "@/lib/hooks/useMounted";

export default function CourierHome() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const mounted = useMounted();
  const { data: jobs } = useApi(listJobs);
  const { data: online } = useApi(getOnline);
  const { data: stats } = useApi(getRiderStats);
  const { busy, error, message, run } = useAction();
  const first = mounted ? (user?.name?.split(" ")[0] ?? "rider") : "";

  const open = (jobs ?? []).filter((j) => j.status === "open");
  const active = (jobs ?? []).find((j) => j.courierId === user?.id && (j.status === "accepted" || j.status === "picked"));

  async function take(id: string) {
    const job = await run(id, () => acceptJob(id), (j) => `Job accepted · head to ${j?.from ?? "pickup"}.`);
    if (job) router.push("/courier/navigate");
  }

  return (
    <div>
      <PageIntro
        crumb="Rider / Dashboard & Delivery Jobs"
        title={`Ready for a campus run, ${first}?`}
        subtitle="Approved rider · Eligible jobs near your campus pickup zone."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="soft">Verification approved</Badge>
        <Button size="sm" variant={online !== false ? "primary" : "outline"} onClick={() => void run("on", () => setOnline(true), "You're online. New jobs will appear here.")}>
          Online{online !== false ? " · selected" : ""}
        </Button>
        <Button size="sm" variant={online === false ? "primary" : "outline"} onClick={() => void run("off", () => setOnline(false), "You're offline. You won't receive new jobs.")}>
          Offline{online === false ? " · selected" : ""}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today's earnings" value={formatRs(stats?.today ?? 0)} hint={`${stats?.todayCount ?? 0} completed deliveries today`} />
        <StatCard
          label="Active delivery"
          value={active ? "1" : "0"}
          hint={active ? `${active.orderId} · ${formatRs(active.payout)} on completion` : "Accept a job to start"}
        />
        <StatCard label="This week" value={formatRs(stats?.week ?? 0)} hint={`${stats?.weekCount ?? 0} completed deliveries`} />
      </div>
      <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">
        Matching: jobs open when a kitchen marks a delivery order ready. One active delivery at a time. Live GPS matching is not connected.
      </p>
      {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {online === false && (
          <Card>
            <h2 className="text-lg font-bold">You&apos;re offline</h2>
            <p className="mt-2 text-sm text-muted">Go online to see delivery jobs near you.</p>
          </Card>
        )}
        {online !== false && open.length === 0 && (
          <Card>
            <h2 className="text-lg font-bold">No open jobs right now</h2>
            <p className="mt-2 text-sm text-muted">New jobs appear here as soon as a cafeteria marks a delivery order ready.</p>
          </Card>
        )}
        {open.slice(0, 4).map((j) => (
          <JobCard
            key={j.id}
            job={j}
            busy={busy === j.id}
            blocked={Boolean(active)}
            onAccept={() => void take(j.id)}
            onDecline={() => void run(`d${j.id}`, () => declineJob(j.id), "Job declined. It stays available for other riders.")}
          />
        ))}
        <Card>
          <h2 className="text-lg font-bold">Active delivery{active ? ` · ${active.orderId}` : ""}</h2>
          {active ? (
            <>
              <Badge tone="soft" className="mt-2">
                {active.status === "picked" ? "Out for Delivery" : "Head to the counter"}
              </Badge>
              <p className="mt-3 font-semibold">
                {active.from} → {active.to}
              </p>
              <p className="text-sm text-muted">
                {Math.max(6, Math.round(active.distanceM / 70))} min walking estimate · {formatRs(active.payout)} on completion
              </p>
              <Link href="/courier/navigate" className="mt-4 inline-block">
                <Button>Open active delivery →</Button>
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No active delivery. Accept a job to get started.</p>
          )}
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
              {(stats?.history ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-muted">
                    No deliveries yet.
                  </td>
                </tr>
              )}
              {(stats?.history ?? []).slice(0, 6).map((j) => {
                const declined = j.courierId !== user?.id;
                return (
                  <tr key={j.id} className="border-t border-border">
                    <td className="py-2 font-semibold">{j.orderId ?? j.id}</td>
                    <td>
                      {declined
                        ? "Declined"
                        : j.status === "delivered"
                          ? `Delivered · ${formatWhen(j.completedAt)}`
                          : j.status === "cancelled"
                            ? "Cancelled by kitchen"
                            : j.status === "picked"
                              ? "Out for delivery"
                              : "Accepted"}
                    </td>
                    <td>{j.status === "delivered" && !declined ? formatRs(j.payout) : "Rs. 0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
