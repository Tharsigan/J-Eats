import { readDb, writeDb } from "../mock-db/db";
import { addLedger, logEvent, walletFor, walletTxn } from "../mock-db/events";
import type { Stall } from "../types";
import { delay, formatRs } from "../utils";
import { ApiError, apiFetch, requireSession, USE_MOCKS } from "./client";

export async function listStalls(): Promise<Stall[]> {
  if (USE_MOCKS) {
    await delay(60);
    return [...readDb().stalls];
  }
  return apiFetch("/stalls");
}

/** Contribute to a faculty fundraising stall from the customer wallet (simulated). */
export async function supportStall(id: string, amount: number): Promise<Stall> {
  if (USE_MOCKS) {
    await delay(250);
    const { userId } = requireSession();
    return writeDb((db) => {
      const stall = db.stalls.find((s) => s.id === id);
      if (!stall) throw new ApiError(404, "Stall not found.");
      if (!(amount >= 50)) throw new ApiError(400, "Minimum contribution is Rs. 50.");
      if (walletFor(db, userId).balance < amount) throw new ApiError(402, "Wallet balance is too low. Top up first.");
      const user = db.users.find((u) => u.id === userId);
      stall.raised += amount;
      walletTxn(db, userId, { label: `Stall support · ${stall.name}`, amount, type: "debit", kind: "donation", ref: stall.id });
      addLedger(db, { ref: stall.id.toUpperCase(), party: user?.name ?? "Customer", amount, type: "donation" });
      logEvent(db, "ok", `${user?.name} supported ${stall.name} with ${formatRs(amount)}`);
      return { ...stall };
    });
  }
  return apiFetch(`/stalls/${id}/support`, { method: "POST", body: JSON.stringify({ amount }) });
}
