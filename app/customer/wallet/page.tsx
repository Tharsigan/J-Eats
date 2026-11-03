"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requestTopUp } from "@/lib/api/wallet";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatRs } from "@/lib/utils";
import { useMemo, useState } from "react";

const PRESETS = [500, 1000, 2000];

export default function WalletPage() {
  const balance = useWalletStore((s) => s.balance);
  const txns = useWalletStore((s) => s.txns);
  const topUp = useWalletStore((s) => s.topUp);
  const [amount, setAmount] = useState(1000);
  const [tab, setTab] = useState("All");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    if (tab === "Top-ups") return txns.filter((t) => t.type === "credit" && t.label.toLowerCase().includes("top"));
    if (tab === "Payments") return txns.filter((t) => t.type === "debit");
    if (tab === "Refunds") return txns.filter((t) => t.label.toLowerCase().includes("refund"));
    return txns;
  }, [tab, txns]);

  async function go() {
    await requestTopUp(amount);
    topUp(amount, `Top-up · Demo gateway`);
    setMsg(`Success: Top-up TU-101 · ${formatRs(amount)} · Receipt available.`);
  }

  return (
    <div>
      <PageIntro
        crumb="Customer / Wallet"
        title="A little balance for your break."
        subtitle="Manage sample top-ups, payments and refunds."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Available wallet balance</h2>
            <p className="mt-2 text-4xl font-bold">{formatRs(balance)}</p>
            <p className="mt-1 text-sm text-muted">Before JE-1042 · Sample balance</p>
            <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">
              After a simulated Rs. 1,800 order payment, the balance would be {formatRs(Math.max(0, balance - 1800))}.
            </p>
            <p className="mt-4 text-sm font-semibold">Top-up amount · Rs.</p>
            <input
              className="field mt-1"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p} size="sm" variant={amount === p ? "primary" : "outline"} onClick={() => setAmount(p)}>
                  {formatRs(p)}
                </Button>
              ))}
            </div>
            <Button className="mt-4" onClick={go}>
              Continue to secure provider
            </Button>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Hosted secure sandbox</h2>
            <Badge tone="warn" className="mt-2">
              Provider not connected
            </Badge>
            <p className="mt-2 text-sm text-muted">
              Empty provider-managed fields. J Eats does not store raw card details. No payment will be processed.
            </p>
            <input className="field mt-3" disabled placeholder="Hosted field unavailable" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="field" disabled placeholder="Expiry" />
              <input className="field" disabled placeholder="Security code" />
            </div>
            <Button className="mt-3" variant="outline" disabled>
              Pay with provider
            </Button>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="overflow-x-auto">
            <h2 className="text-lg font-bold">Transaction history</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {["All", "Top-ups", "Payments", "Refunds"].map((t) => (
                <Button key={t} size="sm" variant={tab === t ? "soft" : "outline"} onClick={() => setTab(t)}>
                  {t}
                </Button>
              ))}
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="font-medium">Amount</th>
                  <th className="font-medium">Status / receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-3 font-semibold">
                      {t.id.toUpperCase()} · {t.at}
                    </td>
                    <td>
                      {t.type === "credit" ? "+" : "−"} {formatRs(t.amount)}
                    </td>
                    <td>{t.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Provider status examples</h2>
            {msg && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{msg}</p>}
            <p className="note-danger mt-2 rounded-xl px-3 py-2 text-sm">
              Failure: TU-102 was not processed. Balance unchanged.
            </p>
            <p className="note-ok mt-2 rounded-xl px-3 py-2 text-sm">Refund: RF-1034 · Rs. 990 returned to sample wallet.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
