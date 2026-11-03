"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { MENU } from "@/lib/mock-data/campus";
import { cartTotal, useCartStore } from "@/lib/stores/cart";
import { useNotifyStore } from "@/lib/stores/notifications";
import { useWalletStore } from "@/lib/stores/wallet";
import type { Fulfillment, PaymentMethod } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";

export default function CheckoutPage() {
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const spend = useWalletStore((s) => s.spend);
  const balance = useWalletStore((s) => s.balance);
  const push = useNotifyStore((s) => s.push);
  const [fulfillment, setFulfillment] = useState<Fulfillment | "preorder">("delivery");
  const [slot, setSlot] = useState("13:00");
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [msg, setMsg] = useState("");
  const total = cartTotal(lines) + (fulfillment === "delivery" ? 100 : 0);
  const hour = new Date().getHours();
  const cashOk = hour < 11;

  function place() {
    if (!lines.length) {
      setMsg("Add items to cart first.");
      return;
    }
    if (method === "cash" && !cashOk) {
      setMsg("Cash pre-orders close at 11:00 AM. Use card or wallet.");
      return;
    }
    if (method === "wallet" && !spend(total, "Sample order payment")) {
      setMsg("Wallet balance is too low. Top up first.");
      return;
    }
    clear();
    push("Order confirmed", `Paid with ${method} · ${formatRs(total)}`);
    setMsg(`Success example: ${formatRs(total)} · Ref PAY-1042 · Receipt RC-1042`);
  }

  return (
    <div>
      <PageIntro
        crumb="Customer / Shopping Cart & Checkout"
        title="One step closer to lunch."
        subtitle="Review your meal, choose fulfilment and preview secure checkout."
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Your cart · {lines.length} items</h2>
            {lines.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Your cart is empty. Explore food to get started.</p>
            ) : (
              lines.map((l) => (
                <div key={l.id} className="mt-4 border-t border-border pt-4">
                  <div className="flex gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl">
                      <Image src={l.image} alt="" fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-sm text-muted">
                        {l.spice} spice · {l.quantity} × {formatRs(l.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <QuantityStepper
                      value={l.quantity}
                      max={MENU.find((m) => m.id === l.itemId)?.stock ?? 8}
                      onChange={(n) => setQty(l.id, n)}
                    />
                    <Button size="sm" variant="soft" onClick={() => remove(l.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
            <p className="mt-4 text-sm font-semibold">Meal subtotal · {formatRs(cartTotal(lines))}</p>
            <p className="note-warn mt-3 rounded-xl px-3 py-2 text-sm">
              Stock-change example: Crispy Chicken Burger now has only 3 available. A previous quantity of 4 requires a fix.
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">How would you like your food?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["delivery", "pickup", "preorder"] as const).map((f) => (
                <Button key={f} size="sm" variant={fulfillment === f ? "soft" : "outline"} onClick={() => setFulfillment(f)}>
                  {f === "preorder" ? "Pre-order" : f[0].toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Destination
              <input className="field mt-1" defaultValue="Library pickup zone" />
            </label>
            <p className="mt-2 text-xs text-muted">Pickup alternative: Central Canteen pickup point</p>
            <p className="mt-4 text-sm font-semibold">Time slot</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "12:30", label: "12:30 · Available" },
                { id: "13:00", label: "13:00 · Selected" },
                { id: "11:30", label: "11:30 · Past", disabled: true },
                { id: "14:00", label: "14:00 · Unavailable", disabled: true },
              ].map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  disabled={s.disabled}
                  variant={slot === s.id ? "primary" : "outline"}
                  onClick={() => setSlot(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Order note · optional
              <input className="field mt-1" placeholder="No sambol, please." />
            </label>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Order summary · JE-1042</h2>
            <p className="mt-2 text-sm text-muted">
              {lines.length || 2} × meals · Delivery fee · {fulfillment === "delivery" ? "Rs. 100" : "Rs. 0"}
            </p>
            <p className="mt-4 text-2xl font-bold">Total · {formatRs(lines.length ? total : 1800)}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant={method === "wallet" ? "soft" : "outline"} onClick={() => setMethod("wallet")}>
                Wallet
              </Button>
              <Button size="sm" variant={method === "card" ? "soft" : "outline"} onClick={() => setMethod("card")}>
                Secure card
              </Button>
            </div>
            <Badge tone="soft" className="mt-3">
              Wallet selected
            </Badge>
            <p className="mt-3 text-sm">Balance before: {formatRs(balance)}</p>
            <p className="text-sm font-semibold">
              Balance after sample payment: {formatRs(Math.max(0, balance - (lines.length ? total : 1800)))}
            </p>
            <Button className="mt-4 w-full" onClick={place}>
              Confirm & pay {formatRs(lines.length ? total : 1800)}
            </Button>
            <p className="mt-2 text-xs text-muted">Static demo action. No payment or inventory reservation occurs.</p>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Hosted secure sandbox</h2>
            <Badge tone="warn" className="mt-2">
              Provider not connected
            </Badge>
            <p className="mt-2 text-sm text-muted">
              Empty provider-managed fields. J Eats does not store raw card details. No payment will be processed.
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
          {msg && (
            <p className="note-ok rounded-xl px-3 py-2 text-sm">{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
