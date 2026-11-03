import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { STALLS } from "@/lib/mock-data/campus";
import { formatRs } from "@/lib/utils";

export default function StallsPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Stall Support"
        title="Faculty stalls, student causes."
        subtitle="Faculty fundraising stalls — pre-order and share the cause."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {STALLS.map((s) => {
          const pct = Math.round((s.raised / s.goal) * 100);
          return (
            <Card key={s.id}>
              <p className="text-xs uppercase tracking-wide text-muted">{s.faculty}</p>
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-muted">{s.cause}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm">
                {formatRs(s.raised)} of {formatRs(s.goal)} · {pct}%
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
