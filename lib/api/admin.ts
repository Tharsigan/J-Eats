import { LEDGER, PEAK_HOURS } from "../mock-data/campus";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

export async function getLedger() {
  if (USE_MOCKS) {
    await delay();
    return LEDGER;
  }
  return apiFetch("/admin/ledger");
}

export async function getPeakHours() {
  if (USE_MOCKS) {
    await delay();
    return PEAK_HOURS;
  }
  return apiFetch("/admin/analytics/peak");
}

export type SystemLog = { id: string; level: string; msg: string; at: string };

export async function getLogs(): Promise<SystemLog[]> {
  if (USE_MOCKS) {
    await delay();
    return [
      { id: "log1", level: "info", msg: "Queue broadcast Central Canteen → 14", at: "12:11 PM" },
      { id: "log2", level: "warn", msg: "Stock low: Egg Hopper Pair (0)", at: "11:58 AM" },
      { id: "log3", level: "info", msg: "Courier Kasun D. accepted job_3", at: "11:44 AM" },
      { id: "log4", level: "ok", msg: "Wallet top-up Rs. 2,000 settled", at: "9:12 AM" },
    ];
  }
  return apiFetch<SystemLog[]>("/admin/logs");
}
