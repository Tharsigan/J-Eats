"use client";

import { VendorCard } from "@/components/food/VendorCard";
import { FoodCard } from "@/components/food/FoodCard";
import { SpicePicker } from "@/components/food/SpicePicker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StarRating } from "@/components/ui/StarRating";
import { TimeSlotPicker } from "@/components/ui/TimeSlotPicker";
import { MENU, REVIEWS, TIME_SLOTS, VENDORS } from "@/lib/mock-data/campus";
import { useCartStore } from "@/lib/stores/cart";
import { useNotifyStore } from "@/lib/stores/notifications";
import type { Fulfillment, MenuItem, SpiceLevel } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import { Bike, CheckCircle2, Clock, Heart, Leaf, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export function FoodDetailView({ item, backHref = "/explore" }: { item: MenuItem; backHref?: string }) {
  const vendor = VENDORS.find((v) => v.id === item.vendorId) ?? VENDORS[0];
  const related = MENU.filter((m) => m.id !== item.id).slice(0, 3);
  const reviews = REVIEWS.filter((r) => r.itemId === item.id);
  const add = useCartStore((s) => s.add);
  const push = useNotifyStore((s) => s.push);

  const [spice, setSpice] = useState<SpiceLevel>("medium");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [slotId, setSlotId] = useState<string | null>(TIME_SLOTS.find((s) => s.available)?.id ?? null);
  const [loved, setLoved] = useState(false);

  const total = item.price * qty;
  const remaining = item.maxPerOrder;

  const slots = useMemo(() => TIME_SLOTS, []);

  function addToCart() {
    add({
      itemId: item.id,
      name: item.name,
      image: item.image,
      unitPrice: item.price,
      quantity: qty,
      spice,
      notes,
      fulfillment,
      slotId,
    });
    push("Added to cart", `${qty} × ${item.name}`);
  }

  return (
    <div className="space-y-12">
      <p className="text-sm text-muted">
        <Link href={backHref} className="hover:text-brand">
          ← Explore Food
        </Link>
        <span> / {item.category}</span>
      </p>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="relative overflow-hidden rounded-3xl">
            <div className="relative aspect-[4/3] w-full">
              <Image src={item.image} alt={item.name} fill className="object-cover" priority />
            </div>
            {item.favourite && (
              <Badge className="absolute left-4 top-4">Campus favourite</Badge>
            )}
            <button
              type="button"
              onClick={() => setLoved((v) => !v)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
              aria-label="Save"
            >
              <Heart className={`h-5 w-5 ${loved ? "fill-rose-400 text-rose-400" : ""}`} />
            </button>
          </div>
          <VendorCard vendor={vendor} />
          <p className="mt-4 flex items-start gap-2 text-sm text-muted">
            <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Prepared fresh on campus. Packed with care, delivered to your door.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{item.category}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{item.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <StarRating value={item.rating} />
              <span className="font-semibold">{item.rating.toFixed(1)}</span>
              <span className="text-muted">({item.reviewCount} reviews)</span>
              <Link href="/customer/reviews" className="text-brand hover:underline">
                See reviews
              </Link>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{item.description}</p>
            <p className="mt-5 text-3xl font-bold">{formatRs(item.price)}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {item.prepMinutes[0]}–{item.prepMinutes[1]} min prep
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4" />
                Delivery from {formatRs(item.deliveryFrom)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Make it your kind of spicy</p>
            <SpicePicker value={spice} onChange={setSpice} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <p className="font-semibold">Special instructions</p>
              <span className="text-muted">Optional</span>
            </div>
            <textarea
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know? e.g. no sambol, please"
              className="min-h-24 w-full rounded-2xl border border-border bg-surface-2/40 px-4 py-3 text-sm outline-none ring-brand/40 placeholder:text-muted focus:ring-2"
            />
            <p className="mt-1 text-xs text-muted">
              We&apos;ll share your note with the kitchen. {notes.length}/500 characters
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Quantity (max {item.maxPerOrder})</p>
              <p className="text-xs text-muted">Max {item.maxPerOrder}</p>
            </div>
            <QuantityStepper value={qty} max={Math.min(item.stock, item.maxPerOrder)} onChange={setQty} />
          </div>

          <Button size="lg" className="w-full" onClick={addToCart} disabled={item.stock === 0}>
            Add to Cart · {formatRs(total)}
          </Button>
          <p className="flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4" />
            Secure online payments. Live order tracking.
          </p>

          <div className="space-y-4">
            <p className="text-sm font-semibold">
              Sample availability · {remaining} available
              <span className="ml-2 text-xs font-normal text-muted">
                {item.stock} available · Max {item.maxPerOrder}
              </span>
            </p>
            <SegmentedControl
              value={fulfillment}
              onChange={setFulfillment}
              options={[
                {
                  value: "pickup",
                  label: (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand" />
                      Pickup
                      <span className="block text-xs font-normal text-muted">Collect at {vendor.name}</span>
                    </span>
                  ),
                },
                {
                  value: "delivery",
                  label: (
                    <span className="flex items-center gap-2">
                      <Bike className="h-4 w-4" />
                      Delivery
                      <span className="block text-xs font-normal text-muted">
                        {formatRs(item.deliveryFrom)} delivery fee
                      </span>
                    </span>
                  ),
                },
              ]}
            />
            <div>
              <p className="mb-2 text-sm font-semibold">Choose a time slot</p>
              <TimeSlotPicker slots={slots} value={slotId} onChange={setSlotId} />
              <p className="mt-2 text-xs text-muted">
                Pickup slots are shown for today. Delivery slots may vary by campus location.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted">Allergen note: {item.allergens}</p>
        </div>
      </div>

      <section>
        <h2 className="text-2xl font-bold">Good food. Good reviews.</h2>
        <p className="mt-1 text-sm text-muted">
          {item.rating.toFixed(1)} out of 5 · from {item.reviewCount} campus foodies
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.author}</p>
                  <StarRating value={r.rating} />
                </div>
                <span className="text-xs text-muted">{r.daysAgo} days ago</span>
              </div>
              <p className="mt-3 text-sm text-muted">{r.body}</p>
              {r.verified && (
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-brand">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified order
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Keep the cravings going</h2>
        <p className="mt-1 text-sm text-muted">A few more student favourites worth a look.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((m) => (
            <FoodCard
              key={m.id}
              item={m}
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
      </section>
    </div>
  );
}
