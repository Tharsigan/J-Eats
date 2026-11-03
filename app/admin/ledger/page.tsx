import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { LEDGER } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";

export default function LedgerPage() {
  return (
    <div className="space-y-4">
      <PageIntro crumb="Admin / Transactions & Reports" title="Money moving across campus." subtitle="Sample ledger of sales, top-ups, payouts and refunds." />
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
            {LEDGER.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{l.ref}</td>
                <td>{l.party}</td>
                <td className="capitalize">{l.type}</td>
                <td className="text-muted">{l.at}</td>
                <td className="pr-4 text-right">{formatRs(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
