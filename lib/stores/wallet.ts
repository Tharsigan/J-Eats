"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletTxn } from "../types";
import { WALLET_TXNS } from "../mock-data/campus";
import { uid } from "../utils";

type WalletState = {
  balance: number;
  txns: WalletTxn[];
  topUp: (amount: number, label?: string) => void;
  spend: (amount: number, label: string) => boolean;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: 2500,
      txns: WALLET_TXNS,
      topUp: (amount, label = "Wallet top-up") =>
        set((s) => ({
          balance: s.balance + amount,
          txns: [
            {
              id: uid("w"),
              label,
              amount,
              type: "credit",
              at: "Just now",
            },
            ...s.txns,
          ],
        })),
      spend: (amount, label) => {
        if (get().balance < amount) return false;
        set((s) => ({
          balance: s.balance - amount,
          txns: [
            { id: uid("w"), label, amount, type: "debit", at: "Just now" },
            ...s.txns,
          ],
        }));
        return true;
      },
    }),
    { name: "jeats-wallet" },
  ),
);
