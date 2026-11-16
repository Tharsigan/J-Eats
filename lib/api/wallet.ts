import { readDb, writeDb } from "../mock-db/db";
import { addLedger, logEvent, notify, walletFor, walletTxn } from "../mock-db/events";
import type { Wallet } from "../types";
import { delay, formatRs } from "../utils";
import { ApiError, apiFetch, requireSession, USE_MOCKS } from "./client";

export const TOPUP_MIN = 100;
export const TOPUP_MAX = 50_000;

export async function getWallet(): Promise<Wallet> {
  if (USE_MOCKS) {
    await delay(60);
    const { userId } = requireSession();
    const wallet = readDb().wallets[userId];
    return wallet ? { ...wallet, txns: [...wallet.txns] } : { userId, balance: 0, txns: [] };
  }
  return apiFetch("/wallet");
}

/**
 * Simulated payment gateway. No card data is collected and nothing is charged:
 * the mock simply credits the wallet and records a ledger entry.
 */
export type TopUpResult = { ok: boolean; amount: number; ref: string; balance: number };

export async function requestTopUp(amount: number, method = "Demo gateway"): Promise<TopUpResult> {
  if (USE_MOCKS) {
    await delay(500);
    const { userId } = requireSession();
    if (!Number.isFinite(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
      throw new ApiError(400, `Top-ups must be between ${formatRs(TOPUP_MIN)} and ${formatRs(TOPUP_MAX)}.`);
    }
    return writeDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      const ref = `TU-${db.counters.ref++}`;
      walletTxn(db, userId, { label: `Top-up · ${method}`, amount, type: "credit", kind: "topup", ref });
      addLedger(db, { ref, party: user?.name ?? "Wallet", amount, type: "topup" });
      notify(db, { userId }, "Wallet topped up", `${formatRs(amount)} added · ${ref}`, "/customer/wallet");
      logEvent(db, "ok", `Wallet top-up ${formatRs(amount)} settled for ${user?.name ?? userId} (${ref})`);
      return { ok: true, amount, ref, balance: walletFor(db, userId).balance };
    });
  }
  return apiFetch("/wallet/topup", { method: "POST", body: JSON.stringify({ amount }) });
}
