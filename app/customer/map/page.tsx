"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Card } from "@/components/ui/Card";
import { listVendors } from "@/lib/api/menu";
import { useApi } from "@/lib/hooks/useApi";
import { MAP_POINTS } from "@/lib/mock-data/campus";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

export default function MapPage() {
  const { data: vendors } = useApi(listVendors);
  const [active, setActive] = useState<string>(MAP_POINTS[0].id);
  const point = MAP_POINTS.find((p) => p.id === active);
  const vendor = vendors?.find((v) => v.name === point?.name);

  return (
    <div className="space-y-6">
      <PageIntro
        crumb="Customer / Campus map"
        title="Find your next pickup pin."
        subtitle="Cafeterias and pickup points across USJ. Tap a pin for details — schematic map, not live GPS."
      />
      <Card className="relative h-[420px] overflow-hidden p-0">
        <svg viewBox="0 0 100 100" className="h-full w-full bg-emerald-950/10">
          <rect x="8" y="12" width="84" height="76" rx="4" className="fill-emerald-900/10 stroke-border" />
          <path d="M12 40 H88 M40 16 V84 M70 16 V84" className="stroke-border" fill="none" />
          {MAP_POINTS.map((p) => (
            <g key={p.id} onClick={() => setActive(p.id)} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r={active === p.id ? 3.4 : 2.4}
                className={cn(p.kind === "cafeteria" ? "fill-brand" : "fill-cyan-400", active === p.id && "stroke-amber-400")}
                strokeWidth={0.8}
              />
              <text x={p.x + 3} y={p.y + 1} className={cn("fill-current text-[3px]", active === p.id && "font-bold")}>
                {p.name}
              </text>
            </g>
          ))}
        </svg>
        {point && (
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-border bg-surface/95 p-3 text-sm shadow-[var(--shadow)] sm:right-auto sm:w-72">
            <p className="font-semibold">{point.name}</p>
            <p className="text-muted capitalize">{point.kind === "cafeteria" ? "Cafeteria" : "Pickup point"}</p>
            {vendor && (
              <p className="mt-1">
                <span className="text-brand">{vendor.openNow ? "Open now" : "Closed"}</span> · closes {vendor.closesAt} · {vendor.queue} in queue
              </p>
            )}
            {point.kind === "cafeteria" ? (
              <Link href="/customer/explore" className="mt-2 inline-block font-semibold text-brand">
                Browse menu →
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted">Use “{point.name}” as your delivery destination at checkout.</p>
            )}
          </div>
        )}
      </Card>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {MAP_POINTS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setActive(p.id)}
              className={cn(
                "w-full rounded-xl border bg-surface px-4 py-3 text-left",
                active === p.id ? "border-brand" : "border-border",
              )}
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-muted">{p.kind}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
