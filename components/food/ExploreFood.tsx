"use client";

import { FoodCard } from "./FoodCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MENU, VENDORS } from "@/lib/mock-data/campus";
import { useCartStore } from "@/lib/stores/cart";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const CATEGORIES = ["All food", "Rice & Curry", "Burgers", "Pizza", "Snacks", "Drinks"];

export function ExploreFood({ itemHrefBase = "/food" }: { itemHrefBase?: string }) {
  const add = useCartStore((s) => s.add);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All food");

  const items = useMemo(() => {
    return MENU.filter((m) => {
      const hay = `${m.name} ${m.category} ${m.tags.join(" ")}`.toLowerCase();
      const matchQ = hay.includes(q.toLowerCase());
      const matchCat =
        cat === "All food" ||
        m.category === cat ||
        (cat === "Drinks" && m.category === "Cool down") ||
        (cat === "Snacks" && (m.category === "Quick bite" || m.category === "Snacks"));
      return matchQ && matchCat;
    });
  }, [q, cat]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Your next good bite</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Explore Food</h1>
        <p className="mt-2 text-muted">Campus classics. Nearby favourites. All in one place.</p>
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for meals, cafeterias, or food vendors"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Filters</p>
            <button type="button" className="text-xs text-brand" onClick={() => { setCat("All food"); setQ(""); }}>
              Reset
            </button>
          </div>
          <p className="mb-2 text-xs font-semibold text-muted">Food category</p>
          <div className="space-y-1">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-2">
                <input type="radio" name="cat" checked={cat === c} onChange={() => setCat(c)} />
                {c}
              </label>
            ))}
          </div>
        </Card>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{items.length} meals near your campus · All vendors open</p>
            <span className="text-sm text-muted">Sort: Popular</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Under Rs. 1,500", "4.5+ stars", "Open now", "Sample stock · not connected to live inventory"].map((t) => (
              <span key={t} className="rounded-full bg-surface px-3 py-1 text-xs text-muted ring-1 ring-border">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((m) => (
              <FoodCard
                key={m.id}
                item={m}
                href={`${itemHrefBase}/${m.id}`}
                vendorName={VENDORS.find((v) => v.id === m.vendorId)?.name}
                onAdd={() =>
                  add({
                    itemId: m.id,
                    name: m.name,
                    image: m.image,
                    unitPrice: m.price,
                    quantity: 1,
                    spice: "medium",
                    notes: "",
                    fulfillment: "pickup",
                    slotId: null,
                  })
                }
              />
            ))}
          </div>
          <Card className="mt-8 flex flex-wrap items-center justify-between gap-3 bg-surface-2">
            <p className="text-sm">
              Not sure what to order? Try the Campus Chicken Rice & Curry. It&apos;s a student favourite for a reason.
            </p>
            <Button variant="soft" size="sm">
              View campus favourite
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
