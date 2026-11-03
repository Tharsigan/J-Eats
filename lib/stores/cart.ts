"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Fulfillment, SpiceLevel } from "../types";
import { uid } from "../utils";

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "id">) => void;
  remove: (id: string) => void;
  setQty: (id: string, quantity: number) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const existing = s.lines.find(
            (l) =>
              l.itemId === line.itemId &&
              l.spice === line.spice &&
              l.notes === line.notes &&
              l.fulfillment === line.fulfillment &&
              l.slotId === line.slotId,
          );
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.id === existing.id ? { ...l, quantity: l.quantity + line.quantity } : l,
              ),
            };
          }
          return { lines: [...s.lines, { ...line, id: uid("cart") }] };
        }),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      setQty: (id, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.id === id ? { ...l, quantity } : l)),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "jeats-cart" },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

export type AddPayload = {
  spice: SpiceLevel;
  fulfillment: Fulfillment;
};
