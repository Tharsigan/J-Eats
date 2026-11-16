"use client";

import { FoodCard } from "./FoodCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listMenu, listVendors } from "@/lib/api/menu";
import { useApi } from "@/lib/hooks/useApi";
import { useCartStore } from "@/lib/stores/cart";
import { useNotifyStore } from "@/lib/stores/notifications";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const CATEGORIES = ["All food", "Rice & Curry", "Burgers", "Pizza", "Snacks", "Drinks"];
const QUICK = ["Under Rs. 1,500", "4.5+ stars", "Open now", "In stock"] as const;
type Quick = (typeof QUICK)[number];
const SORTS = {
  popular: "Popular",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
  prep: "Fastest prep",
} as const;
type SortKey = keyof typeof SORTS;

function matchesCategory(m: MenuItem, cat: string) {
  if (cat === "All food") return true;
  const c = m.category.toLowerCase();
  const name = m.name.toLowerCase();
  if (cat === "Drinks") return c === "cool down" || c === "drinks" || /chocolate|juice|tea|coffee|shake/.test(name);
  if (cat === "Snacks") return ["quick bite", "snacks", "breakfast"].includes(c);
  if (cat === "Burgers") return c.includes("burger") || name.includes("burger");
  if (cat === "Pizza") return c.includes("pizza") || name.includes("pizza");
  return m.category === cat;
}

export function ExploreFood({
  itemHrefBase = "/food",
  initialQuery = "",
  initialCategory = "All food",
}: {
  itemHrefBase?: string;
  initialQuery?: string;
  initialCategory?: string;
}) {
  const add = useCartStore((s) => s.add);
  const lines = useCartStore((s) => s.lines);
  const toast = useNotifyStore((s) => s.push);
  const { data: menu, loading } = useApi(listMenu);
  const { data: vendors } = useApi(listVendors);
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(CATEGORIES.includes(initialCategory) ? initialCategory : "All food");
  const [vendor, setVendor] = useState("all");
  const [quick, setQuick] = useState<Quick[]>([]);
  const [sort, setSort] = useState<SortKey>("popular");

  const vendorById = useMemo(() => new Map((vendors ?? []).map((v) => [v.id, v])), [vendors]);

  const items = useMemo(() => {
    const list = (menu ?? []).filter((m) => {
      const v = vendorById.get(m.vendorId);
      const hay = `${m.name} ${m.category} ${m.tags.join(" ")} ${v?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
      if (!matchesCategory(m, cat)) return false;
      if (vendor !== "all" && m.vendorId !== vendor) return false;
      if (quick.includes("Under Rs. 1,500") && m.price >= 1500) return false;
      if (quick.includes("4.5+ stars") && m.rating < 4.5) return false;
      if (quick.includes("Open now") && v && !v.openNow) return false;
      if (quick.includes("In stock") && (m.stock === 0 || !m.available)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "prep") sorted.sort((a, b) => a.prepMinutes[0] - b.prepMinutes[0]);
    if (sort === "popular") sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    // Sold-out items sink to the bottom.
    return sorted.sort((a, b) => Number(a.stock === 0 || !a.available) - Number(b.stock === 0 || !b.available));
  }, [menu, q, cat, vendor, quick, sort, vendorById]);

  const favourite = (menu ?? []).find((m) => m.id === "m_rice_curry") ?? (menu ?? []).find((m) => m.favourite);
  const openCount = (vendors ?? []).filter((v) => v.openNow).length;

  function quickAdd(m: MenuItem) {
    const inCart = lines.filter((l) => l.itemId === m.id).reduce((n, l) => n + l.quantity, 0);
    if (inCart + 1 > Math.min(m.stock, m.maxPerOrder)) {
      toast("Limit reached", `You already have the maximum ${m.name} in your cart.`, "error");
      return;
    }
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
    });
    toast("Added to cart", `1 × ${m.name}`);
  }

  function reset() {
    setCat("All food");
    setQ("");
    setVendor("all");
    setQuick([]);
    setSort("popular");
  }

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
            <button type="button" className="text-xs text-brand" onClick={reset}>
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
          <p className="mb-2 mt-4 text-xs font-semibold text-muted">Vendor</p>
          <select className="field" value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="all">All vendors</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.openNow ? "" : " (closed)"}
              </option>
            ))}
          </select>
          {vendors && (
            <div className="mt-4 space-y-1 text-xs text-muted">
              <p className="font-semibold">Live queues</p>
              {vendors.map((v) => (
                <p key={v.id} className="flex justify-between gap-2">
                  <span className="truncate">{v.name}</span>
                  <span className={v.queue > 10 ? "text-amber-600" : "text-brand"}>{v.openNow ? `${v.queue} waiting` : "closed"}</span>
                </p>
              ))}
            </div>
          )}
        </Card>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {loading ? "Loading meals…" : `${items.length} meals near your campus · ${openCount} of ${vendors?.length ?? 0} vendors open`}
            </p>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort:
              <select
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((t) => {
              const on = quick.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setQuick((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs ring-1 transition",
                    on ? "bg-brand text-white ring-brand" : "bg-surface text-muted ring-border hover:text-text",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((m) => (
              <FoodCard
                key={m.id}
                item={m}
                href={`${itemHrefBase}/${m.id}`}
                vendorName={vendorById.get(m.vendorId)?.name}
                onAdd={() => quickAdd(m)}
              />
            ))}
          </div>
          {!loading && items.length === 0 && (
            <Card className="mt-4 text-center text-sm text-muted">
              No meals match these filters.{" "}
              <button type="button" className="font-semibold text-brand" onClick={reset}>
                Clear filters
              </button>
            </Card>
          )}
          <Card className="mt-8 flex flex-wrap items-center justify-between gap-3 bg-surface-2">
            <p className="text-sm">
              Not sure what to order? Try the Campus Chicken Rice & Curry. It&apos;s a student favourite for a reason.
            </p>
            {favourite && (
              <Link href={`${itemHrefBase}/${favourite.id}`}>
                <Button variant="soft" size="sm">
                  View campus favourite
                </Button>
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
