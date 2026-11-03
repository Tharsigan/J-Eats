import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

export async function requestTopUp(amount: number) {
  if (USE_MOCKS) {
    await delay();
    return { ok: true, amount };
  }
  return apiFetch("/wallet/topup", { method: "POST", body: JSON.stringify({ amount }) });
}
