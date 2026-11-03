import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { MAP_POINTS } from "@/lib/mock-data/campus";

export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Campus map"
        title="Find your next pickup pin."
        subtitle="Cafeterias and pickup points across USJ. Interactive GPS comes with the live layer."
      />
      <Card className="relative h-[420px] overflow-hidden p-0">
        <svg viewBox="0 0 100 100" className="h-full w-full bg-emerald-950/10">
          <rect x="8" y="12" width="84" height="76" rx="4" className="fill-emerald-900/10 stroke-border" />
          <path d="M12 40 H88 M40 16 V84 M70 16 V84" className="stroke-border" fill="none" />
          {MAP_POINTS.map((p) => (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r="2.4" className={p.kind === "cafeteria" ? "fill-brand" : "fill-cyan-400"} />
              <text x={p.x + 3} y={p.y + 1} className="fill-current text-[3px]">
                {p.name}
              </text>
            </g>
          ))}
        </svg>
      </Card>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {MAP_POINTS.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <span className="font-medium">{p.name}</span>
            <span className="ml-2 text-muted">{p.kind}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
