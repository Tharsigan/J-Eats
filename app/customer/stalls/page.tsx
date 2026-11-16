"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listStalls, supportStall } from "@/lib/api/stalls";
import { getWallet } from "@/lib/api/wallet";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { formatRs } from "@/lib/utils";
import { useState } from "react";

export default function StallsPage() {
  const { data: stalls } = useApi(listStalls);
  const { data: wallet } = useApi(getWallet);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const { busy, error, message, run } = useAction();

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Stall Support"
        title="Faculty stalls, student causes."
        subtitle={`Faculty fundraising stalls — support a cause from your wallet (${formatRs(wallet?.balance ?? 0)} available).`}
      />
      {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(stalls ?? []).map((s) => {
          const pct = Math.min(100, Math.round((s.raised / s.goal) * 100));
          const amount = amounts[s.id] ?? 250;
          return (
            <Card key={s.id}>
              <p className="text-xs uppercase tracking-wide text-muted">{s.faculty}</p>
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-muted">{s.cause}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm">
                {formatRs(s.raised)} of {formatRs(s.goal)} · {pct}%
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[100, 250, 500].map((a) => (
                  <Button key={a} size="sm" variant={amount === a ? "soft" : "outline"} onClick={() => setAmounts((m) => ({ ...m, [s.id]: a }))}>
                    {formatRs(a)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  disabled={busy === s.id || s.raised >= s.goal}
                  onClick={() => void run(s.id, () => supportStall(s.id, amount), `Thank you! ${formatRs(amount)} sent to ${s.name}.`)}
                >
                  {s.raised >= s.goal ? "Goal reached" : "Support"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
