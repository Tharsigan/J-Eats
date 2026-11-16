import { MAP_POINTS } from "@/lib/mock-data/campus";

/** Approximate a campus pin for a place name (schematic only, not GPS). */
export function pinFor(name?: string) {
  const n = (name ?? "").toLowerCase();
  const exact = MAP_POINTS.find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n));
  if (n && exact) return exact;
  if (n.includes("library")) return MAP_POINTS.find((p) => p.id === "p4")!;
  if (n.includes("gate")) return MAP_POINTS.find((p) => p.id === "p3")!;
  if (n.includes("hostel")) return MAP_POINTS.find((p) => p.id === "p5")!;
  if (n.includes("café") || n.includes("cafe")) return MAP_POINTS.find((p) => p.id === "p2")!;
  if (n.includes("management")) return { id: "fm", name: "Faculty of Management", kind: "pickup" as const, x: 30, y: 24 };
  if (n.includes("burger")) return { id: "bl", name: "The Burger Lab", kind: "cafeteria" as const, x: 52, y: 22 };
  if (n.includes("slice") || n.includes("student centre")) return { id: "ss", name: "Slice Society", kind: "cafeteria" as const, x: 74, y: 50 };
  if (n.includes("green") || n.includes("arts")) return { id: "gb", name: "Green Bowl Café", kind: "cafeteria" as const, x: 20, y: 48 };
  return MAP_POINTS[0];
}

/**
 * Schematic campus route between two named places. `progress` (0–1) moves the rider marker.
 */
export function CampusRoute({ from, to, progress = 0 }: { from?: string; to?: string; progress?: number }) {
  const a = pinFor(from);
  const b = pinFor(to);
  const t = Math.min(1, Math.max(0, progress));
  const rx = a.x + (b.x - a.x) * t;
  const ry = a.y + (b.y - a.y) * t;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Route from ${a.name} to ${b.name}`}>
      <rect x="8" y="12" width="84" height="76" rx="8" className="fill-emerald-900/10 stroke-border" />
      <path d="M12 40 H88 M40 16 V84 M70 16 V84" className="stroke-border" fill="none" />
      <polyline points={`${a.x},${a.y} ${b.x},${b.y}`} className="stroke-brand" fill="none" strokeWidth="1.4" strokeDasharray="2 1" />
      <circle cx={a.x} cy={a.y} r="3" className="fill-brand" />
      <circle cx={b.x} cy={b.y} r="3" className="fill-cyan-500" />
      {t > 0 && t < 1 && <circle cx={rx} cy={ry} r="2.2" className="fill-amber-400 stroke-white" strokeWidth="0.6" />}
      <text x={a.x + 3.5} y={a.y + 1} className="fill-current text-[3px]">
        {a.name}
      </text>
      <text x={b.x + 3.5} y={b.y + 1} className="fill-current text-[3px]">
        {b.name}
      </text>
    </svg>
  );
}
