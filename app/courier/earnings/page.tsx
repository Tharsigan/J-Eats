"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getRiderStats, withdrawEarnings } from "@/lib/api/courier";
import { getWallet } from "@/lib/api/wallet";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { formatRs, formatWhen } from "@/lib/utils";

export default function EarningsPage() {
  const { data: stats } = useApi(getRiderStats);
  const { data: wallet } = useApi(getWallet);
  const { busy, error, message, run } = useAction();
  const txns = wallet?.txns ?? [];

  return (
    <div className="space-y-6">
      <PageIntro crumb="Rider / Earnings & Wallet" title="Your campus runs, paid." subtitle="Rider wallet. Withdrawals are simulated bank transfers." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today" value={formatRs(stats?.today ?? 0)} hint={`${stats?.todayCount ?? 0} completed deliveries`} />
        <StatCard label="This week" value={formatRs(stats?.week ?? 0)} hint={`${stats?.weekCount ?? 0} completed deliveries`} />
        <StatCard label="Available to withdraw" value={formatRs(wallet?.balance ?? 0)} hint="Weekly settlement · demo" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy === "w" || !wallet?.balance}
          onClick={() => void run("w", withdrawEarnings, (r) => `${formatRs(r.amount)} sent to your bank account (simulated).`)}
        >
          Withdraw {formatRs(wallet?.balance ?? 0)}
        </Button>
        {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
        {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      </div>
      {txns.length === 0 && <Card className="text-sm text-muted">No earnings yet. Complete a delivery to get paid.</Card>}
      {txns.map((t) => (
        <Card key={t.id} className="flex flex-wrap justify-between gap-2 py-3">
          <span>
            {t.label} <span className="text-xs text-muted">· {formatWhen(t.createdAt, t.at)}</span>
          </span>
          <span className={`font-semibold ${t.type === "credit" ? "text-brand" : "text-muted"}`}>
            {t.type === "credit" ? "+" : "−"}
            {formatRs(t.amount)}
          </span>
        </Card>
      ))}
    </div>
  );
}
