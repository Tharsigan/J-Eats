"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getInventory, patchInventory } from "@/lib/api/cafeteria";
import type { InventoryRow } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function MenuOpsPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);

  useEffect(() => {
    getInventory().then(setRows);
  }, []);

  async function bump(id: string, stock: number) {
    const next = await patchInventory(id, { stock });
    if (next) setRows((r) => r.map((x) => (x.id === id ? next : x)));
  }

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Cafeteria / Menu Management & Inventory"
        title="Keep the board honest."
        subtitle="Sample stock only. Restock before the lunch rush."
      />
      {rows.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{r.name}</p>
            <p className="text-sm text-muted">
              {formatRs(r.price)} · {r.available ? "on menu" : "hidden"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => bump(r.id, Math.max(0, r.stock - 1))}>
              −
            </Button>
            <span className="min-w-10 text-center font-semibold">{r.stock}</span>
            <Button variant="outline" size="sm" onClick={() => bump(r.id, r.stock + 1)}>
              +
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
