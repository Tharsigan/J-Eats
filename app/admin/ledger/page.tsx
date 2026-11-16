"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getLedger } from "@/lib/api/admin";
import { useApi } from "@/lib/hooks/useApi";
import type { LedgerEntry } from "@/lib/types";
import { downloadText, formatRs, formatWhen } from "@/lib/utils";
import { useMemo, useState } from "react";

const TYPES: (LedgerEntry["type"] | "all")[] = ["all", "sale", "topup", "payout", "refund", "donation"];

export default function LedgerPage() {
  const { data } = useApi(() => getLedger("all"), []);
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [q, setQ] = useState("");
  const all = useMemo(() => data ?? [], [data]);
  const rows = all.filter(
    (l) => (type === "all" || l.type === type) && `${l.ref} ${l.party}`.toLowerCase().includes(q.toLowerCase()),
  );
  const sum = (t: LedgerEntry["type"]) => all.filter((l) => l.type === t).reduce((n, l) => n + l.amount, 0);

  function exportCsv() {
    const lines = ["Reference,Party,Type,When,Amount", ...rows.map((l) => `${l.ref},"${l.party}",${l.type},${l.createdAt ?? l.at},${l.amount}`)];
    downloadText(`jeats-ledger-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
  }

  return (
    <div className="space-y-4">
      <PageIntro crumb="Admin / Transactions & Reports" title="Money moving across campus." subtitle="Live ledger of sales, top-ups, payouts and refunds (simulated money)." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales" value={formatRs(sum("sale"))} hint={`${all.filter((l) => l.type === "sale").length} paid orders`} />
        <StatCard label="Wallet top-ups" value={formatRs(sum("topup"))} />
        <StatCard label="Rider payouts" value={formatRs(sum("payout"))} />
        <StatCard label="Refunds" value={formatRs(sum("refund"))} hint={`Net ${formatRs(sum("sale") - sum("refund"))}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <Button key={t} size="sm" variant={type === t ? "soft" : "outline"} onClick={() => setType(t)} className="capitalize">
            {t}
          </Button>
        ))}
        <input className="field h-9 max-w-xs" placeholder="Search ref or party" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </Button>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="font-medium">Party</th>
              <th className="font-medium">Type</th>
              <th className="font-medium">When</th>
              <th className="pr-4 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted">
                  No entries.
                </td>
              </tr>
            )}
            {rows.slice(0, 200).map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{l.ref}</td>
                <td>{l.party}</td>
                <td className="capitalize">{l.type}</td>
                <td className="text-muted">{formatWhen(l.createdAt, l.at)}</td>
                <td className={`pr-4 text-right ${l.type === "refund" || l.type === "payout" ? "text-danger" : ""}`}>
                  {l.type === "refund" || l.type === "payout" ? "−" : ""}
                  {formatRs(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
