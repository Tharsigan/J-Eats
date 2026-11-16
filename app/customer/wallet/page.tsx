"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getWallet, requestTopUp, TOPUP_MAX, TOPUP_MIN } from "@/lib/api/wallet";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { downloadText, formatRs, formatWhen } from "@/lib/utils";
import { useMemo, useState } from "react";

const PRESETS = [500, 1000, 2000];
const TABS = ["All", "Top-ups", "Payments", "Refunds"] as const;

export default function WalletPage() {
  const { data: wallet } = useApi(getWallet);
  const [amount, setAmount] = useState(1000);
  const [method, setMethod] = useState("Card (simulated)");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [failed, setFailed] = useState("");
  const { busy, error, message, run, setError } = useAction();
  const balance = wallet?.balance ?? 0;
  const txns = useMemo(() => wallet?.txns ?? [], [wallet]);

  const filtered = useMemo(() => {
    if (tab === "Top-ups") return txns.filter((t) => t.kind === "topup" || (t.type === "credit" && t.label.toLowerCase().includes("top")));
    if (tab === "Payments") return txns.filter((t) => t.type === "debit");
    if (tab === "Refunds") return txns.filter((t) => t.kind === "refund" || t.label.toLowerCase().includes("refund"));
    return txns;
  }, [tab, txns]);

  const lastPayment = txns.find((t) => t.type === "debit");
  const lastRefund = txns.find((t) => t.kind === "refund");

  async function go() {
    setFailed("");
    if (!Number.isFinite(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
      setError(`Enter an amount between ${formatRs(TOPUP_MIN)} and ${formatRs(TOPUP_MAX)}.`);
      setFailed(`Failure: top-up of ${formatRs(amount || 0)} was not processed. Balance unchanged.`);
      return;
    }
    await run("topup", () => requestTopUp(amount, method), (r) => `Success: ${r.ref} · ${formatRs(r.amount)} added · New balance ${formatRs(r.balance)}.`);
  }

  function exportStatement() {
    const rows = ["Reference,Date,Description,Type,Amount", ...txns.map((t) => `${t.ref ?? t.id},${t.createdAt ?? t.at},"${t.label}",${t.type},${t.amount}`)];
    downloadText("jeats-wallet-statement.csv", rows.join("\n"), "text/csv");
  }

  return (
    <div>
      <PageIntro
        crumb="Customer / Wallet"
        title="A little balance for your break."
        subtitle="Manage simulated top-ups, payments and refunds."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Available wallet balance</h2>
            <p className="mt-2 text-4xl font-bold">{formatRs(balance)}</p>
            <p className="mt-1 text-sm text-muted">Updated live · demo balance</p>
            {lastPayment && (
              <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">
                Last payment: {lastPayment.label} · {formatRs(lastPayment.amount)} · {formatWhen(lastPayment.createdAt, lastPayment.at)}
              </p>
            )}
            <p className="mt-4 text-sm font-semibold">Top-up amount · Rs.</p>
            <input
              className="field mt-1"
              type="number"
              min={TOPUP_MIN}
              max={TOPUP_MAX}
              step={100}
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p} size="sm" variant={amount === p ? "primary" : "outline"} onClick={() => setAmount(p)}>
                  {formatRs(p)}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold">Method</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Card (simulated)", "Dialog eZ Cash (simulated)", "Bank transfer (simulated)"].map((m) => (
                <Button key={m} size="sm" variant={method === m ? "soft" : "outline"} onClick={() => setMethod(m)}>
                  {m}
                </Button>
              ))}
            </div>
            <Button className="mt-4" onClick={() => void go()} disabled={busy === "topup"}>
              {busy === "topup" ? "Contacting demo gateway…" : `Top up ${formatRs(Number.isFinite(amount) ? amount : 0)}`}
            </Button>
            {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Hosted secure sandbox</h2>
            <Badge tone="warn" className="mt-2">
              Provider not connected
            </Badge>
            <p className="mt-2 text-sm text-muted">
              Empty provider-managed fields. J Eats does not store raw card details. Top-ups above are simulated and no payment is processed.
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Transaction history</h2>
              <Button size="sm" variant="ghost" onClick={exportStatement} disabled={!txns.length}>
                Export CSV
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TABS.map((t) => (
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-muted">
                      No transactions here yet.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-3 font-semibold">
                      {(t.ref ?? t.id).toUpperCase()} · <span className="font-normal text-muted">{formatWhen(t.createdAt, t.at)}</span>
                    </td>
                    <td className={t.type === "credit" ? "text-brand" : ""}>
                      {t.type === "credit" ? "+" : "−"} {formatRs(t.amount)}
                    </td>
                    <td>{t.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Provider status</h2>
            {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
            {failed && <p className="note-danger mt-2 rounded-xl px-3 py-2 text-sm">{failed}</p>}
            {lastRefund ? (
              <p className="note-ok mt-2 rounded-xl px-3 py-2 text-sm">
                Refund: {lastRefund.label} · {formatRs(lastRefund.amount)} returned to your wallet.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Refunds for cancelled wallet orders appear here automatically.</p>
            )}
            {!message && !failed && <p className="mt-2 text-sm text-muted">Top up above to see a gateway confirmation.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
