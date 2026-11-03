"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { broadcastQueue, getQueue } from "@/lib/api/cafeteria";
import { PEAK_HOURS } from "@/lib/mock-data/campus";
import { useNotifyStore } from "@/lib/stores/notifications";
import { useEffect, useState } from "react";

export default function QueuePage() {
  const [n, setN] = useState(14);
  const push = useNotifyStore((s) => s.push);
  const max = Math.max(...PEAK_HOURS.map((p) => p.value));

  useEffect(() => {
    getQueue().then((q) => setN(q.queueLength));
  }, []);

  return (
    <div className="space-y-6">
      <PageIntro crumb="Cafeteria / Analytics" title="See the lunch wave coming." subtitle="Queue length plus a sample peak-hour chart." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <p className="text-sm text-muted">People waiting at Central Canteen</p>
          <p className="text-6xl font-bold">{n}</p>
          <input type="range" min={0} max={40} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          <Button
            onClick={async () => {
              await broadcastQueue(n);
              push("Queue updated", `${n} in line at Central Canteen`);
            }}
          >
            Broadcast to campus
          </Button>
        </Card>
        <Card>
          <p className="mb-4 text-sm font-semibold">Peak hours (sample)</p>
          <div className="flex h-40 items-end gap-2">
            {PEAK_HOURS.map((p) => (
              <div key={p.hour} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${(p.value / max) * 100}%` }} />
                <span className="text-[10px] text-muted">{p.hour}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
