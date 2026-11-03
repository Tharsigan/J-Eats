import { INVENTORY, ORDERS } from "../mock-data/campus";
import type { InventoryRow, Order } from "../types";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

let inventory = [...INVENTORY];
let queueLength = 14;

export async function getInventory(): Promise<InventoryRow[]> {
  if (USE_MOCKS) {
    await delay();
    return inventory;
  }
  return apiFetch("/cafeteria/inventory");
}

export async function patchInventory(
  id: string,
  patch: Partial<InventoryRow>,
): Promise<InventoryRow | undefined> {
  if (USE_MOCKS) {
    inventory = inventory.map((r) => (r.id === id ? { ...r, ...patch } : r));
    return inventory.find((r) => r.id === id);
  }
  return apiFetch<InventoryRow>(`/cafeteria/inventory/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function incomingOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay();
    return ORDERS;
  }
  return apiFetch("/cafeteria/orders");
}

export async function broadcastQueue(n: number) {
  if (USE_MOCKS) {
    queueLength = n;
    return { queueLength };
  }
  return apiFetch("/cafeteria/queue", { method: "POST", body: JSON.stringify({ n }) });
}

export async function getQueue() {
  if (USE_MOCKS) return { queueLength };
  return apiFetch<{ queueLength: number }>("/cafeteria/queue");
}
