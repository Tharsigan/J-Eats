import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { PEAK_HOURS } from "@/lib/mock-data/campus";

export default function AnalyticsPage() {
  const max = Math.max(...PEAK_HOURS.map((p) => p.value));
  return (
    <div className="space-y-6">
      <PageIntro crumb="Admin / Reports" title="Peak hours across the campus." subtitle="Orders by hour (campus time) · sample series" />
      <Card>
        <p className="mb-6 text-sm text-muted">Orders by hour</p>
        <div className="flex h-48 items-end gap-2">
          {PEAK_HOURS.map((p) => (
            <div key={p.hour} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-brand/80" style={{ height: `${(p.value / max) * 100}%` }} />
              <span className="text-[10px] text-muted">{p.hour}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
