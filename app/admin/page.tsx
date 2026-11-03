import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { LEDGER, ORDERS, PEAK_HOURS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";
import Link from "next/link";

export default function AdminHome() {
  const sales = LEDGER.filter((l) => l.type === "sale").reduce((n, l) => n + l.amount, 0);
  const max = Math.max(...PEAK_HOURS.map((p) => p.value));

  return (
    <div>
      <PageIntro
        crumb="Admin / Overview"
        title="A clear view of campus operations."
        subtitle="Authorised administrator · Sample platform overview"
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm">Today</Button>
        <Button size="sm" variant="outline">
          7 days
        </Button>
        <Button size="sm" variant="outline">
          30 days
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value="1,248" hint="1,100 students · 98 academic · 50 non-academic" />
        <StatCard label="Riders" value="32" hint="26 approved · 6 pending" />
        <StatCard label="Cafeterias" value="8" hint="6 approved · 2 pending" />
        <StatCard label="Orders today" value="40" hint="34 completed · 4 active · 2 cancelled" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Orders by hour · Today</h2>
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
          <h2 className="font-bold">Operational snapshot</h2>
          <p className="mt-3 text-3xl font-bold">{formatRs(Math.max(sales, 38000))}</p>
          <p className="text-sm text-muted">Sample transaction volume · Today · Gross provider receipts</p>
          <p className="mt-3 text-sm">3 active deliveries</p>
          <p className="note-warn mt-4 rounded-xl px-3 py-2 text-sm">6 rider applications and 2 cafeteria applications need review.</p>
          <Link href="/admin/logs" className="mt-4 inline-block">
            <Button>Review pending approvals →</Button>
          </Link>
        </Card>
        <Card>
          <h2 className="font-bold">Customer account breakdown</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Category</th>
                <th className="font-medium">Accounts</th>
                <th className="font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Student", "1,100", "88.1%"],
                ["Academic Staff", "98", "7.9%"],
                ["Non-Academic Staff", "50", "4.0%"],
                ["Total customers", "1,248", "100%"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-border">
                  <td className="py-2">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="font-bold">Operational alerts</h2>
          <Badge tone="warn" className="mt-3">
            Payments · Not connected
          </Badge>
          <p className="mt-2 text-sm text-muted">Sandbox provider setup is required before accepting payments.</p>
          <Badge tone="warn" className="mt-3">
            Maps & matching · Not connected
          </Badge>
          <p className="mt-2 text-sm text-muted">Tracking is schematic; delivery assignments are sample states.</p>
          <Link href="/admin/logs" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              Open System Settings
            </Button>
          </Link>
        </Card>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <h2 className="font-bold">Recent sample activity</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-medium">Time</th>
              <th className="font-medium">Event</th>
              <th className="font-medium">Reference</th>
              <th className="font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["12:12", "Order collected by authorised rider", "JE-1042", "Out for Delivery"],
              ["12:05", "Rider application submitted", "RV-006", "Pending review"],
              ["11:58", "Cafeteria document resubmitted", "CF-002", "Pending review"],
            ].map((r) => (
              <tr key={r[1]} className="border-t border-border">
                {r.map((c) => (
                  <td key={c} className="py-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{ORDERS.length} live sample orders on the board.</p>
      </Card>
    </div>
  );
}
