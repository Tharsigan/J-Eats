import { ORDERS } from "../mock-data/campus";
import type { Order } from "../types";
import { delay, uid } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

let localOrders = [...ORDERS];

export async function listOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay();
    return localOrders;
  }
  return apiFetch("/orders");
}

export async function trackOrder(id: string): Promise<Order | undefined> {
  if (USE_MOCKS) {
    await delay();
    return localOrders.find((o) => o.id === id) ?? localOrders[0];
  }
  return apiFetch(`/orders/${id}`);
}

export async function placeOrder(order: Omit<Order, "id" | "placedAt">): Promise<Order> {
  if (USE_MOCKS) {
    await delay();
    const created: Order = {
      ...order,
      id: `JE-${uid("").slice(-4).toUpperCase()}`,
      placedAt: "Just now",
    };
    localOrders = [created, ...localOrders];
    return created;
  }
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(order) });
}
