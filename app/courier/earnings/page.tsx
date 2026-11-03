"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatRs } from "@/lib/utils";

export default function EarningsPage() {
  const txns = useWalletStore((s) => s.txns);
  const payouts = txns.filter((t) => t.label.toLowerCase().includes("courier") || t.type === "credit");
  return (
    <div className="space-y-6">
      <PageIntro crumb="Rider / Earnings & Wallet" title="Your campus runs, paid." subtitle="Sample rider wallet. Payouts are illustrative." />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="This week" value={formatRs(1840)} hint="24 completed sample deliveries" />
        <StatCard label="Available to withdraw" value={formatRs(500)} hint="Weekly settlement · demo" />
      </div>
      {payouts.map((t) => (
        <Card key={t.id} className="flex justify-between py-3">
          <span>{t.label}</span>
          <span className="font-semibold text-brand">+{formatRs(t.amount)}</span>
        </Card>
      ))}
    </div>
  );
}
