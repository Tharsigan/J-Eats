"use client";

import { MarketingShell } from "@/components/layout/MarketingShell";
import { FoodCard } from "@/components/food/FoodCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MENU, VENDORS } from "@/lib/mock-data/campus";
import { useCartStore } from "@/lib/stores/cart";
import { Bike, Clock, Search, ShieldCheck, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const CATS = [
  { name: "Rice & Curry", img: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80" },
  { name: "Burgers", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80" },
  { name: "Pizza", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80" },
  { name: "Snacks", img: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=400&q=80" },
  { name: "Drinks", img: "https://images.unsplash.com/photo-1542990253-0b8be3adc3d8?auto=format&fit=crop&w=400&q=80" },
];

export default function Home() {
  const add = useCartStore((s) => s.add);
  const featured = MENU.slice(0, 4);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">A little break. A big bite.</p>
        <div className="mt-4 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-5xl font-bold tracking-tight">Your Campus Cravings, Delivered!</h1>
            <p className="mt-4 text-muted">Browse sample meals, check availability, and order in just a few clicks.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <label className="flex min-w-64 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm">
                <Search className="h-4 w-4 text-muted" />
                <input className="w-full bg-transparent outline-none" placeholder="Search for meals, cafeterias, or food vendors" />
              </label>
              <Link href="/explore">
                <Button>Order Now</Button>
              </Link>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Bike className="h-4 w-4" /> Campus delivery
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" /> Secure payments
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[1.75rem]">
            <Image
              src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80"
              alt="Campus lunch"
              width={900}
              height={640}
              className="h-[340px] w-full object-cover"
              priority
            />
            <Card className="absolute bottom-4 left-4 max-w-xs py-3">
              <p className="text-sm font-semibold">Your lunch break, upgraded.</p>
              <p className="text-xs text-muted">Campus favourite · from Rs. 850 · 4.8 · Loved by students</p>
            </Card>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-3xl font-bold">Demo</p>
            <p className="text-sm text-muted">Sample availability shown</p>
          </Card>
          <Card>
            <p className="text-3xl font-bold">18</p>
            <p className="text-sm text-muted">Campus Chicken Rice & Curry available</p>
          </Card>
          <Card>
            <p className="text-3xl font-bold">3</p>
            <p className="text-sm text-muted">Crispy Chicken Burger available</p>
          </Card>
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">What are you craving?</h2>
          <p className="mt-1 text-sm text-muted">A proper meal or a quick pinch-me-up. You choose.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {CATS.map((c) => (
              <Link key={c.name} href="/explore" className="text-center">
                <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full">
                  <Image src={c.img} alt="" fill className="object-cover" />
                </div>
                <p className="mt-2 text-sm font-semibold">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">The campus favourites</h2>
              <p className="mt-1 text-sm text-muted">Sample stock levels shown for each meal. Ordering actions reflect availability.</p>
            </div>
            <Link href="/explore" className="text-sm font-semibold text-brand">
              Explore all food →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((m) => (
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

        <section className="mt-14">
          <h2 className="text-2xl font-bold">Good food, close to class</h2>
          <p className="mt-1 text-sm text-muted">Meet the university cafeterias that keep your day going.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {VENDORS.slice(0, 3).map((v, i) => (
              <article key={v.id} className="overflow-hidden rounded-[1.4rem] border border-border bg-surface">
                <div className="relative h-40">
                  <Image
                    src={
                      i === 0
                        ? "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
                        : i === 1
                          ? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
                          : "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80"
                    }
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{v.name}</h3>
                  <p className="text-sm text-muted">{v.location}</p>
                  <p className="mt-2 text-sm text-brand">Open now · Closes at {v.closesAt}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-2">
          <Card className="bg-surface-2">
            <p className="text-xs font-semibold text-brand">Student-sized prices</p>
            <h3 className="mt-2 text-xl font-bold">Your first bite is on us.</h3>
            <p className="mt-2 text-sm text-muted">Take 20% off your first order up to Rs. 350.</p>
            <Button variant="soft" className="mt-4" size="sm">
              Use firstbite
            </Button>
          </Card>
          <Card className="bg-[#10231c] text-white">
            <h3 className="text-xl font-bold">Lunch crew? Sorted.</h3>
            <p className="mt-2 text-sm text-white/70">Free delivery on orders over Rs. 1,500.</p>
            <Button className="mt-4 bg-white text-brand hover:bg-white/90" size="sm">
              Use campuscrew
            </Button>
          </Card>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">From craving to campus in three steps.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Search, t: "Find your favourite", d: "Browse campus cafeterias and nearby food vendors." },
              { icon: UtensilsCrossed, t: "Order & pay online", d: "Customise your meal and check out securely in a few clicks." },
              { icon: Clock, t: "Track every bite", d: "Follow your order from the kitchen to your campus doorstep." },
            ].map((s) => (
              <Card key={s.t}>
                <s.icon className="h-5 w-5 text-brand" />
                <h3 className="mt-3 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </Card>
            ))}
          </div>
          <Link href="/explore" className="mt-6 inline-block">
            <Button>Find my next meal</Button>
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
