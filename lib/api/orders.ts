import { nextOrderId, nextRef, readDb, writeDb, type MockDb } from "../mock-db/db";
import { addLedger, logEvent, notify, notifyVendor, walletFor, walletTxn } from "../mock-db/events";
import type { CartLine, Fulfillment, Order, OrderStatus, PaymentMethod } from "../types";
import { delay, formatRs } from "../utils";
import { ApiError, apiFetch, requireSession, USE_MOCKS } from "./client";

export const ACTIVE_STATUSES: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];

export type PlaceOrderPayload = {
  lines: CartLine[];
  fulfillment: Fulfillment;
  payment: PaymentMethod;
  destination: string;
  slot: string;
  notes: string;
  preOrder?: boolean;
  scheduledFor?: string;
  promoCode?: string;
};

export type PlaceOrderResult = { orders: Order[]; total: number; paymentRef: string };

export const PROMOS: Record<string, string> = {
  FIRSTBITE: "20% off your first order, up to Rs. 350",
  CAMPUSCREW: "Free delivery on orders over Rs. 1,500",
};

/** Work out a promo discount. Throws a friendly error when the code does not apply. */
export function promoDiscount(
  db: MockDb,
  userId: string,
  code: string | undefined,
  subtotal: number,
  deliveryFees: number,
): { discount: number; code?: string } {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return { discount: 0 };
  if (c === "FIRSTBITE") {
    const ordered = db.orders.some((o) => o.customerId === userId && o.status !== "cancelled");
    if (ordered) throw new ApiError(400, "FIRSTBITE is only valid on your first order.");
    return { discount: Math.min(350, Math.round(subtotal * 0.2)), code: c };
  }
  if (c === "CAMPUSCREW") {
    if (subtotal < 1500) throw new ApiError(400, "CAMPUSCREW needs a meal subtotal of Rs. 1,500 or more.");
    if (!deliveryFees) throw new ApiError(400, "CAMPUSCREW gives free delivery — choose delivery to use it.");
    return { discount: deliveryFees, code: c };
  }
  throw new ApiError(400, `Promo code “${c}” is not valid.`);
}

/** Preview a promo code at checkout without placing an order. */
export async function checkPromo(code: string, subtotal: number, deliveryFees: number) {
  if (USE_MOCKS) {
    const { userId } = requireSession();
    const r = promoDiscount(readDb(), userId, code, subtotal, deliveryFees);
    return { ...r, description: r.code ? PROMOS[r.code] : "" };
  }
  return apiFetch<{ discount: number; code?: string; description: string }>("/promos/check", {
    method: "POST",
    body: JSON.stringify({ code, subtotal, deliveryFees }),
  });
}

const sortNewest = (a: Order, b: Order) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

/** Restore stock and refund wallet/card payments for an order that will not be fulfilled. */
export function releaseOrder(db: MockDb, order: Order, reason: string, by: string) {
  order.lines?.forEach((l) => {
    const item = db.menu.find((m) => m.id === l.itemId);
    if (item) item.stock += l.qty;
  });
  const at = new Date().toISOString();
  order.status = "cancelled";
  order.cancelReason = reason;
  order.timeline = [...(order.timeline ?? []), { status: "cancelled", at, note: `${by}: ${reason}` }];
  if (order.jobId) {
    const job = db.jobs.find((j) => j.id === order.jobId);
    if (job && job.status !== "delivered") job.status = "cancelled";
  }
  if (order.paymentStatus === "paid") {
    order.paymentStatus = "refunded";
    if (order.payment === "wallet" && order.customerId && db.wallets[order.customerId]) {
      walletTxn(db, order.customerId, {
        label: `Refund · ${order.id}`,
        amount: order.total,
        type: "credit",
        kind: "refund",
        ref: order.id,
      });
    }
    addLedger(db, { ref: order.id, party: order.customerName, amount: order.total, type: "refund" });
  }
}

export async function listOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay(120);
    return [...readDb().orders].sort(sortNewest);
  }
  return apiFetch("/orders");
}

/** Orders for the signed-in customer. */
export async function listMyOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay(120);
    const { userId } = requireSession();
    return readDb()
      .orders.filter((o) => o.customerId === userId)
      .sort(sortNewest);
  }
  return apiFetch("/orders/mine");
}

export async function getOrder(id: string): Promise<Order | undefined> {
  if (USE_MOCKS) {
    await delay(80);
    return readDb().orders.find((o) => o.id === id);
  }
  return apiFetch(`/orders/${id}`);
}

/** Kept for compatibility: returns the requested order or the customer's latest active one. */
export async function trackOrder(id?: string): Promise<Order | undefined> {
  if (USE_MOCKS) {
    await delay(80);
    const db = readDb();
    if (id) {
      const found = db.orders.find((o) => o.id === id);
      if (found) return found;
    }
    const session = requireSession();
    const mine = db.orders.filter((o) => o.customerId === session.userId).sort(sortNewest);
    return mine.find((o) => ACTIVE_STATUSES.includes(o.status)) ?? mine[0];
  }
  return apiFetch(`/orders/${id ?? "latest"}`);
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  if (USE_MOCKS) {
    await delay(450);
    const session = requireSession();
    return writeDb((db) => {
      const user = db.users.find((u) => u.id === session.userId);
      if (!user) throw new ApiError(401, "Please sign in again to place an order.");
      if (!db.settings.orderingOpen) {
        throw new ApiError(423, "Ordering is temporarily paused by the campus administrator.");
      }
      if (!payload.lines.length) throw new ApiError(400, "Your cart is empty.");
      if (payload.fulfillment === "delivery" && !payload.destination.trim()) {
        throw new ApiError(400, "Enter a campus delivery destination.");
      }
      if (payload.payment === "cash" && !payload.preOrder && new Date().getHours() >= db.settings.cashCutoffHour) {
        throw new ApiError(400, `Cash orders close at ${db.settings.cashCutoffHour}:00. Use wallet or card.`);
      }

      // Validate stock for every line before changing anything.
      const needed = new Map<string, number>();
      payload.lines.forEach((l) => needed.set(l.itemId, (needed.get(l.itemId) ?? 0) + l.quantity));
      for (const [itemId, qty] of needed) {
        const item = db.menu.find((m) => m.id === itemId);
        if (!item || !item.available) throw new ApiError(409, `${item?.name ?? "An item"} is no longer on the menu.`);
        if (item.stock < qty) {
          throw new ApiError(409, `Only ${item.stock} × ${item.name} left. Update the quantity to continue.`);
        }
        const vendor = db.vendors.find((v) => v.id === item.vendorId);
        if (vendor && !vendor.openNow) throw new ApiError(409, `${vendor.name} is closed right now.`);
      }

      // One order per vendor, so each kitchen only sees its own ticket.
      const byVendor = new Map<string, CartLine[]>();
      payload.lines.forEach((l) => {
        const vendorId = db.menu.find((m) => m.id === l.itemId)!.vendorId;
        byVendor.set(vendorId, [...(byVendor.get(vendorId) ?? []), l]);
      });
      const fee = payload.fulfillment === "delivery" ? db.settings.deliveryFee : 0;
      const cartSubtotal = payload.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
      const promo = promoDiscount(db, user.id, payload.promoCode, cartSubtotal, fee * byVendor.size);
      let discountLeft = promo.discount;
      const grandTotal =
        [...byVendor.values()].reduce((n, ls) => n + ls.reduce((m, l) => m + l.unitPrice * l.quantity, 0) + fee, 0) -
        promo.discount;

      if (payload.payment === "wallet") {
        const wallet = walletFor(db, user.id);
        if (wallet.balance < grandTotal) {
          throw new ApiError(402, `Wallet balance ${formatRs(wallet.balance)} is too low for ${formatRs(grandTotal)}. Top up first.`);
        }
      }

      const paymentRef = nextRef(db, payload.payment === "cash" ? "CASH" : "PAY");
      const createdAt = new Date().toISOString();
      const created: Order[] = [];
      byVendor.forEach((ls, vendorId) => {
        const vendor = db.vendors.find((v) => v.id === vendorId);
        const lines = ls.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          qty: l.quantity,
          unitPrice: l.unitPrice,
          spice: l.spice,
          notes: l.notes,
          image: l.image,
        }));
        lines.forEach((l) => {
          const item = db.menu.find((m) => m.id === l.itemId)!;
          item.stock -= l.qty;
        });
        const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
        const discount = Math.min(discountLeft, subtotal + fee);
        discountLeft -= discount;
        const order: Order = {
          id: nextOrderId(db),
          customerId: user.id,
          customerName: user.name,
          vendorId,
          vendorName: vendor?.name,
          items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.unitPrice * l.qty })),
          lines,
          total: subtotal + fee - discount,
          deliveryFee: fee,
          discount: discount || undefined,
          promoCode: discount ? promo.code : undefined,
          status: "placed",
          fulfillment: payload.fulfillment,
          payment: payload.payment,
          placedAt: createdAt,
          createdAt,
          pickupPoint: payload.fulfillment === "pickup" ? vendor?.name : payload.destination,
          destination: payload.fulfillment === "pickup" ? vendor?.name : payload.destination.trim(),
          slot: payload.slot,
          preOrder: payload.preOrder,
          scheduledFor: payload.scheduledFor,
          notes: payload.notes.trim() || undefined,
          paymentRef,
          paymentStatus: payload.payment === "cash" ? "pending" : "paid",
          timeline: [{ status: "placed", at: createdAt }],
        };
        db.orders.unshift(order);
        created.push(order);

        if (payload.payment !== "cash") {
          addLedger(db, { ref: order.id, party: user.name, amount: order.total, type: "sale" });
        }
        notifyVendor(
          db,
          vendorId,
          `New ${order.preOrder ? "pre-order" : "order"} ${order.id}`,
          `${user.name} · ${order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · ${order.fulfillment}`,
          "/cafeteria/orders",
        );
        logEvent(db, "info", `Order ${order.id} placed by ${user.name} at ${vendor?.name ?? vendorId} (${formatRs(order.total)})`);
        db.menu
          .filter((m) => lines.some((l) => l.itemId === m.id) && m.stock <= 3)
          .forEach((m) => logEvent(db, "warn", `Stock low: ${m.name} (${m.stock})`));
      });

      if (payload.payment === "wallet") {
        walletTxn(db, user.id, {
          label: `Order ${created.map((o) => o.id).join(", ")}`,
          amount: grandTotal,
          type: "debit",
          kind: "payment",
          ref: paymentRef,
        });
      }
      notify(
        db,
        { userId: user.id },
        "Order confirmed",
        `${created.map((o) => o.id).join(", ")} · ${formatRs(grandTotal)} · ${payload.payment === "card" ? "card (simulated)" : payload.payment}`,
        `/customer/track?id=${created[0].id}`,
      );
      return { orders: created, total: grandTotal, paymentRef };
    });
  }
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(payload) });
}

export async function cancelOrder(id: string, reason: string): Promise<Order> {
  if (USE_MOCKS) {
    await delay(250);
    const session = requireSession();
    return writeDb((db) => {
      const order = db.orders.find((o) => o.id === id && o.customerId === session.userId);
      if (!order) throw new ApiError(404, "Order not found.");
      if (!["placed", "accepted"].includes(order.status)) {
        throw new ApiError(409, "This order is already being prepared and can no longer be cancelled.");
      }
      releaseOrder(db, order, reason.trim() || "Cancelled by customer", "Customer");
      notifyVendor(db, order.vendorId, `Order ${order.id} cancelled`, `${order.customerName}: ${order.cancelReason}`, "/cafeteria/orders");
      notify(
        db,
        { userId: order.customerId },
        `Order ${order.id} cancelled`,
        order.paymentStatus === "refunded" ? `${formatRs(order.total)} refunded to your ${order.payment}.` : "No charge was made.",
        "/customer/orders",
      );
      logEvent(db, "info", `Order ${order.id} cancelled by customer`);
      return { ...order };
    });
  }
  return apiFetch(`/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export async function rescheduleOrder(id: string, slot: string, scheduledFor?: string): Promise<Order> {
  if (USE_MOCKS) {
    await delay(200);
    const session = requireSession();
    return writeDb((db) => {
      const order = db.orders.find((o) => o.id === id && o.customerId === session.userId);
      if (!order) throw new ApiError(404, "Order not found.");
      if (order.status !== "placed") throw new ApiError(409, "Only orders the kitchen has not accepted can be rescheduled.");
      order.slot = slot;
      if (scheduledFor) order.scheduledFor = scheduledFor;
      notifyVendor(db, order.vendorId, `Order ${order.id} rescheduled`, `${order.customerName} moved pickup to ${slot}.`, "/cafeteria/orders");
      logEvent(db, "info", `Order ${order.id} rescheduled to ${slot}`);
      return { ...order };
    });
  }
  return apiFetch(`/orders/${id}/reschedule`, { method: "POST", body: JSON.stringify({ slot, scheduledFor }) });
}

/** Plain-text receipt. The Flask API can return a PDF from the same route later. */
export async function getReceipt(id: string): Promise<string> {
  if (USE_MOCKS) {
    const order = readDb().orders.find((o) => o.id === id);
    if (!order) throw new ApiError(404, "Order not found.");
    const lines = (order.lines ?? []).map(
      (l) => `  ${l.qty} × ${l.name.padEnd(32)} ${formatRs(l.unitPrice * l.qty)}`,
    );
    return [
      "J EATS · UNIVERSITY OF SRI JAYEWARDENEPURA",
      "Demo receipt — no real payment was processed",
      "".padEnd(52, "-"),
      `Order      ${order.id}`,
      `Receipt    RC-${order.id.slice(3)}`,
      `Payment    ${order.paymentRef ?? "-"} · ${order.payment} · ${order.paymentStatus ?? "paid"}`,
      `Vendor     ${order.vendorName ?? "-"}`,
      `Customer   ${order.customerName}`,
      `Placed     ${new Date(order.createdAt ?? Date.now()).toLocaleString("en-GB")}`,
      `Fulfilment ${order.fulfillment}${order.destination ? ` · ${order.destination}` : ""}${order.slot ? ` · ${order.slot}` : ""}`,
      `Status     ${order.status.replaceAll("_", " ")}`,
      "".padEnd(52, "-"),
      ...lines,
      `  Delivery fee${"".padEnd(29)} ${formatRs(order.deliveryFee ?? 0)}`,
      ...(order.discount ? [`  Promo ${order.promoCode ?? ""}${"".padEnd(Math.max(1, 35 - (order.promoCode ?? "").length))}-${formatRs(order.discount)}`] : []),
      "".padEnd(52, "-"),
      `  TOTAL${"".padEnd(36)} ${formatRs(order.total)}`,
      "",
    ].join("\n");
  }
  return apiFetch(`/orders/${id}/receipt`);
}
