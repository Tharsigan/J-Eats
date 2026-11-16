"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { getSettings } from "@/lib/api/admin";
import { listMenu, listSlots, listVendors } from "@/lib/api/menu";
import { checkPromo, placeOrder } from "@/lib/api/orders";
import { getWallet } from "@/lib/api/wallet";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { cartTotal, useCartStore } from "@/lib/stores/cart";
import { useNotifyStore } from "@/lib/stores/notifications";
import type { Fulfillment, PaymentMethod } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMounted } from "@/lib/hooks/useMounted";
import { useEffect, useMemo, useState } from "react";

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const toast = useNotifyStore((s) => s.push);
  const { data: menu } = useApi(listMenu);
  const { data: vendors } = useApi(listVendors);
  const { data: wallet } = useApi(getWallet);
  const { data: settings } = useApi(getSettings);

  const [fulfillment, setFulfillment] = useState<Fulfillment | "preorder">("delivery");
  const [dayOffset, setDayOffset] = useState(0);
  const [preFulfil, setPreFulfil] = useState<Fulfillment>("pickup");
  const [slot, setSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [destination, setDestination] = useState("Library pickup zone");
  const [note, setNote] = useState("");
  const mounted = useMounted();
  const [promoDraft, setPromoInput] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ code: string; discount: number; description: string } | null>(null);
  const [promoError, setPromoError] = useState("");
  const { busy, error, run, setError } = useAction();

  // A code saved from the landing page ("Use firstbite") pre-fills the promo field.
  let savedPromo = "";
  if (mounted) {
    try {
      savedPromo = sessionStorage.getItem("jeats-promo") ?? "";
    } catch {
      // storage unavailable
    }
  }
  const promoInput = promoDraft ?? savedPromo;

  const preorder = fulfillment === "preorder";
  const mode: Fulfillment = preorder ? preFulfil : (fulfillment as Fulfillment);
  const effectiveDay = preorder ? Math.max(1, dayOffset) : 0;
  const { data: slots } = useApi(() => listSlots(isoDay(effectiveDay)), [effectiveDay]);
  const selectedSlot = slot && slots?.find((s) => s.id === slot && s.available) ? slot : (slots?.find((s) => s.available)?.id ?? null);

  const cart = useMemo(() => (mounted ? lines : []), [mounted, lines]);
  const vendorIds = new Set(cart.map((l) => menu?.find((m) => m.id === l.itemId)?.vendorId).filter(Boolean));
  const fee = mode === "delivery" ? (settings?.deliveryFee ?? 100) : 0;
  const subtotal = cartTotal(cart);
  const fees = fee * Math.max(1, vendorIds.size);
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal + fees - discount);

  // Re-validate an applied promo whenever the cart or fulfilment changes.
  useEffect(() => {
    if (!promo) return;
    checkPromo(promo.code, subtotal, mode === "delivery" ? fees : 0)
      .then((r) => {
        if (r.discount !== promo.discount) setPromo(r.code ? { code: r.code, discount: r.discount, description: r.description } : null);
      })
      .catch((e: Error) => {
        setPromo(null);
        setPromoError(e.message);
      });
  }, [subtotal, fees, mode, promo]);

  async function applyPromo() {
    setPromoError("");
    try {
      const r = await checkPromo(promoInput, subtotal, mode === "delivery" ? fees : 0);
      setPromo(r.code ? { code: r.code, discount: r.discount, description: r.description } : null);
    } catch (e) {
      setPromo(null);
      setPromoError(e instanceof Error ? e.message : "Promo code not valid.");
    }
  }
  const balance = wallet?.balance ?? 0;
  const cutoff = settings?.cashCutoffHour ?? 11;
  const cashOk = preorder || new Date().getHours() < cutoff;

  const problems = useMemo(
    () =>
      cart
        .map((l) => {
          const item = menu?.find((m) => m.id === l.itemId);
          const vendor = vendors?.find((v) => v.id === item?.vendorId);
          if (!item || !item.available) return { id: l.id, msg: `${l.name} is no longer on the menu. Remove it to continue.` };
          if (vendor && !vendor.openNow) return { id: l.id, msg: `${vendor.name} is closed. Remove ${l.name} or try later.` };
          if (item.stock < l.quantity) {
            return {
              id: l.id,
              msg: `${l.name} now has only ${item.stock} available. Your quantity of ${l.quantity} needs a fix.`,
              fix: item.stock,
            };
          }
          return null;
        })
        .filter((p): p is { id: string; msg: string; fix?: number } => Boolean(p)),
    [cart, menu, vendors],
  );

  async function place() {
    if (!cart.length) {
      setError("Add items to cart first.");
      return;
    }
    if (problems.length) {
      setError("Fix the highlighted cart items before paying.");
      return;
    }
    if (!selectedSlot) {
      setError("Choose an available time slot.");
      return;
    }
    if (method === "cash" && !cashOk) {
      setError(`Cash orders close at ${cutoff}:00. Use card or wallet.`);
      return;
    }
    const result = await run("place", () =>
      placeOrder({
        lines: cart,
        fulfillment: mode,
        payment: method,
        destination: mode === "delivery" ? destination : "",
        slot: selectedSlot,
        notes: note,
        preOrder: preorder,
        scheduledFor: isoDay(effectiveDay),
        promoCode: promo?.code,
      }),
    );
    if (result) {
      clear();
      try {
        sessionStorage.removeItem("jeats-promo");
      } catch {
        // ignore
      }
      toast("Order placed", `${result.orders.map((o) => o.id).join(", ")} · ${formatRs(result.total)}`);
      router.push(`/customer/track?id=${result.orders[0].id}`);
    }
  }

  return (
    <div>
      <PageIntro
        crumb="Customer / Shopping Cart & Checkout"
        title="One step closer to lunch."
        subtitle="Review your meal, choose fulfilment and confirm a simulated checkout."
      />
      {settings && !settings.orderingOpen && (
        <p className="note-warn mb-4 rounded-xl px-3 py-2 text-sm">
          Ordering is paused by campus operations. You can still build your cart.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Your cart · {cart.reduce((n, l) => n + l.quantity, 0)} items</h2>
              {cart.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clear}>
                  Clear cart
                </Button>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Your cart is empty.{" "}
                <Link href="/customer/explore" className="font-semibold text-brand">
                  Explore food
                </Link>{" "}
                to get started.
              </p>
            ) : (
              cart.map((l) => {
                const item = menu?.find((m) => m.id === l.itemId);
                const vendor = vendors?.find((v) => v.id === item?.vendorId);
                const problem = problems.find((p) => p.id === l.id);
                return (
                  <div key={l.id} className="mt-4 border-t border-border pt-4">
                    <div className="flex gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                        <Image src={l.image} alt="" fill className="object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{l.name}</p>
                        <p className="text-sm text-muted">
                          {vendor?.name ? `${vendor.name} · ` : ""}
                          {l.spice} spice · {l.quantity} × {formatRs(l.unitPrice)}
                        </p>
                        {l.notes && <p className="text-xs text-muted">Note: {l.notes}</p>}
                      </div>
                      <p className="font-semibold">{formatRs(l.unitPrice * l.quantity)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <QuantityStepper
                        value={l.quantity}
                        max={Math.max(1, Math.min(item?.stock ?? 8, item?.maxPerOrder ?? 8))}
                        onChange={(n) => setQty(l.id, n)}
                      />
                      <Button size="sm" variant="soft" onClick={() => remove(l.id)}>
                        Remove
                      </Button>
                    </div>
                    {problem && (
                      <p className="note-warn mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
                        {problem.msg}
                        {problem.fix ? (
                          <Button size="sm" variant="outline" onClick={() => setQty(l.id, problem.fix!)}>
                            Set to {problem.fix}
                          </Button>
                        ) : null}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <p className="mt-4 text-sm font-semibold">Meal subtotal · {formatRs(subtotal)}</p>
            {vendorIds.size > 1 && (
              <p className="mt-1 text-xs text-muted">
                Your cart has items from {vendorIds.size} vendors, so it will be split into {vendorIds.size} orders.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-bold">How would you like your food?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["delivery", "pickup", "preorder"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={fulfillment === f ? "soft" : "outline"}
                  onClick={() => {
                    setFulfillment(f);
                    setSlot(null);
                    if (f === "preorder" && dayOffset === 0) setDayOffset(1);
                  }}
                >
                  {f === "preorder" ? "Pre-order" : f[0].toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            {preorder && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Pre-order as</span>
                {(["pickup", "delivery"] as const).map((f) => (
                  <Button key={f} size="sm" variant={preFulfil === f ? "soft" : "outline"} onClick={() => setPreFulfil(f)}>
                    {f === "pickup" ? "Pickup" : "Delivery"}
                  </Button>
                ))}
              </div>
            )}
            {mode === "delivery" ? (
              <label className="mt-4 block text-sm font-semibold">
                Destination
                <input
                  className="field mt-1"
                  value={destination}
                  list="campus-destinations"
                  onChange={(e) => setDestination(e.target.value)}
                />
                <datalist id="campus-destinations">
                  {["Library pickup zone", "Library steps", "Hostel Block C", "Gate 2 · Faculty entrance", "Faculty of Management"].map(
                    (d) => (
                      <option key={d} value={d} />
                    ),
                  )}
                </datalist>
              </label>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Pickup at the vendor counter{vendorIds.size === 1 && vendors ? ` · ${vendors.find((v) => vendorIds.has(v.id))?.name}` : ""}.
              </p>
            )}
            {preorder && (
              <>
                <p className="mt-4 text-sm font-semibold">Pre-order day</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={effectiveDay === d ? "primary" : "outline"}
                      onClick={() => {
                        setDayOffset(d);
                        setSlot(null);
                      }}
                    >
                      {dayLabel(d)}
                    </Button>
                  ))}
                </div>
              </>
            )}
            <p className="mt-4 text-sm font-semibold">Time slot · {dayLabel(effectiveDay)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(slots ?? []).map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  disabled={!s.available}
                  variant={selectedSlot === s.id ? "primary" : "outline"}
                  onClick={() => setSlot(s.id)}
                >
                  {s.label} · {selectedSlot === s.id ? "Selected" : s.hint}
                </Button>
              ))}
            </div>
            {slots && !slots.some((s) => s.available) && (
              <p className="mt-2 text-xs text-muted">No slots left today — choose Pre-order to schedule for another day.</p>
            )}
            <label className="mt-4 block text-sm font-semibold">
              Order note · optional
              <input className="field mt-1" placeholder="No sambol, please." value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Order summary</h2>
            <p className="mt-2 text-sm text-muted">
              {cart.reduce((n, l) => n + l.quantity, 0)} × meals · Delivery fee · {formatRs(fees)}
              {discount > 0 ? ` · Promo −${formatRs(discount)}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                className="field h-9"
                placeholder="Promo code (FIRSTBITE, CAMPUSCREW)"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              />
              {promo ? (
                <Button size="sm" variant="outline" onClick={() => { setPromo(null); setPromoInput(""); }}>
                  Remove
                </Button>
              ) : (
                <Button size="sm" variant="soft" onClick={() => void applyPromo()} disabled={!promoInput.trim() || !cart.length}>
                  Apply
                </Button>
              )}
            </div>
            {promo && <p className="mt-2 text-xs text-brand">{promo.code} applied · {promo.description}</p>}
            {promoError && <p className="mt-2 text-xs text-danger">{promoError}</p>}
            <p className="mt-4 text-2xl font-bold">Total · {formatRs(total)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={method === "wallet" ? "soft" : "outline"} onClick={() => setMethod("wallet")}>
                Wallet
              </Button>
              <Button size="sm" variant={method === "card" ? "soft" : "outline"} onClick={() => setMethod("card")}>
                Secure card
              </Button>
              <Button
                size="sm"
                variant={method === "cash" ? "soft" : "outline"}
                onClick={() => setMethod("cash")}
                disabled={!cashOk}
                title={cashOk ? "" : `Cash orders close at ${cutoff}:00`}
              >
                Cash {cashOk ? "" : `· closes ${cutoff}:00`}
              </Button>
            </div>
            <Badge tone="soft" className="mt-3">
              {method === "wallet" ? "Wallet selected" : method === "card" ? "Card · simulated approval" : "Cash on pickup / delivery"}
            </Badge>
            {method === "wallet" && (
              <>
                <p className="mt-3 text-sm">Balance before: {formatRs(balance)}</p>
                <p className={`text-sm font-semibold ${balance < total ? "text-danger" : ""}`}>
                  Balance after payment: {formatRs(balance - total)}
                </p>
                {balance < total && (
                  <Link href="/customer/wallet" className="mt-1 inline-block text-sm font-semibold text-brand">
                    Top up wallet →
                  </Link>
                )}
              </>
            )}
            <Button className="mt-4 w-full" onClick={() => void place()} disabled={busy === "place" || !cart.length || !slots || !menu || !wallet}>
              {busy === "place" ? "Placing order…" : `Confirm & pay ${formatRs(total)}`}
            </Button>
            <p className="mt-2 text-xs text-muted">Demo checkout. Stock is reserved in the mock database; no real payment is taken.</p>
            {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Hosted secure sandbox</h2>
            <Badge tone="warn" className="mt-2">
              Provider not connected
            </Badge>
            <p className="mt-2 text-sm text-muted">
              {method === "card"
                ? "Card payments are approved instantly by the demo gateway. J Eats never stores raw card details."
                : "Empty provider-managed fields. J Eats does not store raw card details. No payment will be processed."}
            </p>
            <input className="field mt-3" placeholder="Hosted field unavailable" disabled />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="field" placeholder="Expiry" disabled />
              <input className="field" placeholder="Security code" disabled />
            </div>
            <Button className="mt-3" variant="outline" disabled>
              Pay with provider
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
