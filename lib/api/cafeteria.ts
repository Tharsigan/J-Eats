import { readDb, writeDb, type MockDb } from "../mock-db/db";
import { logEvent, notify } from "../mock-db/events";
import type { CourierJob, InventoryRow, MenuItem, Order, OrderStatus, Vendor } from "../types";
import { delay, formatRs, uid } from "../utils";
import { ApiError, apiFetch, requireSession, USE_MOCKS } from "./client";
import { releaseOrder } from "./orders";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80";

const MAX_PHOTO_CHARS = 550_000; // ~400KB of image data once base64-encoded

/** Accept uploaded photos (data URLs) and Unsplash URLs; anything else is rejected. */
function cleanImage(image: string | undefined) {
  const v = (image ?? "").trim();
  if (!v) return "";
  if (v.startsWith("data:image/")) {
    if (v.length > MAX_PHOTO_CHARS) throw new ApiError(413, "That photo is too large. Choose a smaller image.");
    return v;
  }
  if (v.startsWith("https://images.unsplash.com/")) return v;
  throw new ApiError(400, "Upload the photo as a JPG or PNG file.");
}

function myVendorId(db: MockDb) {
  const { userId } = requireSession();
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.role !== "cafeteria") throw new ApiError(403, "Cafeteria access only.");
  if (!user.vendorId) throw new ApiError(404, "No cafeteria is linked to this account yet.");
  return user.vendorId;
}

function toRow(m: MenuItem): InventoryRow {
  return { id: m.id, name: m.name, stock: m.stock, price: m.price, available: m.available };
}

export async function getMyVendor(): Promise<Vendor | undefined> {
  if (USE_MOCKS) {
    const db = readDb();
    const id = myVendorId(db);
    return db.vendors.find((v) => v.id === id);
  }
  return apiFetch("/cafeteria/vendor");
}

export async function updateMyVendor(patch: Partial<Pick<Vendor, "openNow" | "closesAt" | "location">>): Promise<Vendor> {
  if (USE_MOCKS) {
    return writeDb((db) => {
      const id = myVendorId(db);
      const vendor = db.vendors.find((v) => v.id === id)!;
      Object.assign(vendor, patch);
      if (patch.openNow !== undefined) logEvent(db, "info", `${vendor.name} is now ${vendor.openNow ? "open" : "closed"}`);
      return { ...vendor };
    });
  }
  return apiFetch<Vendor>("/cafeteria/vendor", { method: "PATCH", body: JSON.stringify(patch) });
}

/** Full menu rows for the signed-in cafeteria (used by Menu Management). */
export async function listMyMenu(): Promise<MenuItem[]> {
  if (USE_MOCKS) {
    await delay(120);
    const db = readDb();
    const id = myVendorId(db);
    return db.menu.filter((m) => m.vendorId === id);
  }
  return apiFetch("/cafeteria/menu");
}

export async function getInventory(): Promise<InventoryRow[]> {
  if (USE_MOCKS) {
    return (await listMyMenu()).map(toRow);
  }
  return apiFetch("/cafeteria/inventory");
}

export async function patchInventory(id: string, patch: Partial<MenuItem>): Promise<InventoryRow | undefined> {
  if (USE_MOCKS) {
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      const item = db.menu.find((m) => m.id === id && m.vendorId === vendorId);
      if (!item) throw new ApiError(404, "Menu item not found.");
      if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price <= 0)) {
        throw new ApiError(400, "Price must be greater than zero.");
      }
      if (patch.stock !== undefined) patch.stock = Math.max(0, Math.round(patch.stock));
      if (patch.image !== undefined) patch.image = cleanImage(patch.image) || DEFAULT_IMAGE;
      Object.assign(item, patch);
      if (patch.available !== undefined) {
        logEvent(db, "info", `${item.name} ${item.available ? "shown on" : "hidden from"} the menu`);
      }
      if (patch.stock !== undefined && item.stock <= 3) logEvent(db, "warn", `Stock low: ${item.name} (${item.stock})`);
      return toRow(item);
    });
  }
  return apiFetch<InventoryRow>(`/cafeteria/inventory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export type NewMenuItem = {
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  maxPerOrder: number;
  image?: string;
  prepMin: number;
  prepMax: number;
};

export async function createMenuItem(input: NewMenuItem): Promise<MenuItem> {
  if (USE_MOCKS) {
    await delay(200);
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      if (!input.name.trim()) throw new ApiError(400, "Item name is required.");
      if (!(input.price > 0)) throw new ApiError(400, "Price must be greater than zero.");
      const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const item: MenuItem = {
        id: uid("m"),
        name: input.name.trim(),
        slug,
        category: input.category || "Snacks",
        description: input.description.trim() || "Freshly prepared on campus.",
        price: Math.round(input.price),
        currency: "LKR",
        image: cleanImage(input.image) || DEFAULT_IMAGE,
        rating: 0,
        reviewCount: 0,
        prepMinutes: [Math.max(1, input.prepMin), Math.max(input.prepMin, input.prepMax)],
        deliveryFrom: db.settings.deliveryFee,
        stock: Math.max(0, Math.round(input.stock)),
        maxPerOrder: Math.max(1, Math.round(input.maxPerOrder)),
        favourite: false,
        tags: ["New"],
        vendorId,
        allergens: "Contact the vendor for specific dietary needs.",
        available: true,
      };
      db.menu.push(item);
      logEvent(db, "ok", `${db.vendors.find((v) => v.id === vendorId)?.name} added ${item.name} (${formatRs(item.price)})`);
      return item;
    });
  }
  return apiFetch("/cafeteria/menu", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteMenuItem(id: string): Promise<{ ok: boolean }> {
  if (USE_MOCKS) {
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      const item = db.menu.find((m) => m.id === id && m.vendorId === vendorId);
      if (!item) throw new ApiError(404, "Menu item not found.");
      db.menu = db.menu.filter((m) => m.id !== id);
      logEvent(db, "info", `${item.name} removed from the menu`);
      return { ok: true };
    });
  }
  return apiFetch(`/cafeteria/menu/${id}`, { method: "DELETE" });
}

/** Orders placed with the signed-in cafeteria. */
export async function incomingOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay(120);
    const db = readDb();
    const id = myVendorId(db);
    return db.orders
      .filter((o) => o.vendorId === id)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  return apiFetch("/cafeteria/orders");
}

const NEXT_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "preparing",
  preparing: "ready",
};

const CUSTOMER_COPY: Partial<Record<OrderStatus, string>> = {
  accepted: "accepted your order",
  preparing: "started preparing your order",
  ready: "has your order ready",
  delivered: "marked your order as collected",
};

/**
 * Move an order one step through the kitchen pipeline. When a delivery order becomes
 * ready, a courier job is opened so riders can claim it.
 */
export async function advanceOrder(id: string, next?: OrderStatus): Promise<Order> {
  if (USE_MOCKS) {
    await delay(200);
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      const order = db.orders.find((o) => o.id === id && o.vendorId === vendorId);
      if (!order) throw new ApiError(404, "Order not found.");
      let target = next ?? NEXT_STEP[order.status];
      if (order.status === "ready" && order.fulfillment === "pickup") target = "delivered";
      if (!target) throw new ApiError(409, "This order has no further kitchen step.");
      if (target === "delivered" && order.fulfillment === "delivery") {
        throw new ApiError(409, "Delivery orders are completed by the rider.");
      }
      const at = new Date().toISOString();
      order.status = target;
      order.timeline = [...(order.timeline ?? []), { status: target, at }];
      if (target === "delivered" && order.payment === "cash") order.paymentStatus = "paid";

      if (target === "ready" && order.fulfillment === "delivery" && !order.jobId) {
        const job: CourierJob = {
          id: uid("job"),
          from: order.vendorName ?? "Campus vendor",
          to: order.destination ?? "Campus pickup zone",
          payout: db.settings.riderPayout,
          distanceM: 350 + Math.floor(Math.random() * 700),
          items: order.items.reduce((n, i) => n + i.qty, 0),
          status: "open",
          orderId: order.id,
          customerName: order.customerName,
          createdAt: at,
          declinedBy: [],
        };
        db.jobs.unshift(job);
        order.jobId = job.id;
        notify(db, { role: "courier" }, "New delivery job", `${job.from} → ${job.to} · earn ${formatRs(job.payout)}`, "/courier/jobs");
      }
      const copy = CUSTOMER_COPY[target];
      if (copy && order.customerId) {
        notify(
          db,
          { userId: order.customerId },
          `Order ${order.id}`,
          `${order.vendorName} ${copy}.${target === "ready" && order.fulfillment === "delivery" ? " A rider is being assigned." : ""}`,
          `/customer/track?id=${order.id}`,
        );
      }
      logEvent(db, target === "delivered" ? "ok" : "info", `${order.vendorName}: ${order.id} → ${target.replaceAll("_", " ")}`);
      return { ...order };
    });
  }
  return apiFetch(`/cafeteria/orders/${id}/status`, { method: "POST", body: JSON.stringify({ status: next }) });
}

export async function rejectOrder(id: string, reason: string): Promise<Order> {
  if (USE_MOCKS) {
    await delay(200);
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      const order = db.orders.find((o) => o.id === id && o.vendorId === vendorId);
      if (!order) throw new ApiError(404, "Order not found.");
      if (["delivered", "cancelled", "out_for_delivery"].includes(order.status)) {
        throw new ApiError(409, "This order can no longer be rejected.");
      }
      releaseOrder(db, order, reason.trim() || "Kitchen unable to fulfil", order.vendorName ?? "Cafeteria");
      if (order.customerId) {
        notify(
          db,
          { userId: order.customerId },
          `Order ${order.id} declined`,
          `${order.vendorName}: ${order.cancelReason}.${order.paymentStatus === "refunded" ? ` ${formatRs(order.total)} refunded.` : ""}`,
          "/customer/orders",
        );
      }
      logEvent(db, "warn", `${order.vendorName} rejected ${order.id}: ${order.cancelReason}`);
      return { ...order };
    });
  }
  return apiFetch(`/cafeteria/orders/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
}

export async function broadcastQueue(n: number): Promise<{ queueLength: number }> {
  if (USE_MOCKS) {
    return writeDb((db) => {
      const vendorId = myVendorId(db);
      db.queues[vendorId] = Math.max(0, Math.round(n));
      const name = db.vendors.find((v) => v.id === vendorId)?.name;
      logEvent(db, "info", `Queue broadcast ${name} → ${db.queues[vendorId]}`);
      notify(db, { role: "customer" }, `${name} queue update`, `${db.queues[vendorId]} people waiting right now.`, "/customer/explore");
      return { queueLength: db.queues[vendorId] };
    });
  }
  return apiFetch("/cafeteria/queue", { method: "POST", body: JSON.stringify({ n }) });
}

export async function getQueue(): Promise<{ queueLength: number }> {
  if (USE_MOCKS) {
    const db = readDb();
    return { queueLength: db.queues[myVendorId(db)] ?? 0 };
  }
  return apiFetch<{ queueLength: number }>("/cafeteria/queue");
}

export type VendorStats = {
  sales: number;
  completed: number;
  active: number;
  cancelled: number;
  total: number;
  rating: number;
  reviewCount: number;
  bestsellers: { itemId: string; name: string; qty: number; image: string; price: number; stock: number }[];
  byHour: { hour: string; value: number }[];
  byDay: { d: string; v: number }[];
};

export type StatsRange = "today" | "week" | "month";

export function rangeStart(range: StatsRange) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(d.getDate() - 29);
  return d.getTime();
}

export function hourBuckets(orders: Order[]) {
  const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"];
  return hours.map((hour) => ({
    hour,
    value: orders.filter((o) => new Date(o.createdAt ?? 0).getHours() === Number(hour)).length,
  }));
}

export async function getVendorStats(range: StatsRange): Promise<VendorStats> {
  if (USE_MOCKS) {
    await delay(100);
    const db = readDb();
    const vendorId = myVendorId(db);
    const from = rangeStart(range);
    const all = db.orders.filter((o) => o.vendorId === vendorId);
    const inRange = all.filter((o) => new Date(o.createdAt ?? 0).getTime() >= from);
    const done = inRange.filter((o) => o.status === "delivered");
    const qty = new Map<string, number>();
    inRange
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => o.lines?.forEach((l) => qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty)));
    const bestsellers = [...qty.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([itemId, q]) => {
        const m = db.menu.find((x) => x.id === itemId);
        return { itemId, name: m?.name ?? itemId, qty: q, image: m?.image ?? DEFAULT_IMAGE, price: m?.price ?? 0, stock: m?.stock ?? 0 };
      });
    const itemIds = new Set(db.menu.filter((m) => m.vendorId === vendorId).map((m) => m.id));
    const reviews = db.reviews.filter((r) => itemIds.has(r.itemId));
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const end = d.getTime() + 86_400_000;
      const v = all
        .filter((o) => o.status !== "cancelled")
        .filter((o) => {
          const t = new Date(o.createdAt ?? 0).getTime();
          return t >= d.getTime() && t < end;
        })
        .reduce((n, o) => n + o.total, 0);
      return { d: d.toLocaleDateString("en-GB", { weekday: "short" }), v };
    });
    return {
      sales: inRange.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0),
      completed: done.length,
      active: all.filter((o) => ["placed", "accepted", "preparing", "ready", "out_for_delivery"].includes(o.status)).length,
      cancelled: inRange.filter((o) => o.status === "cancelled").length,
      total: inRange.length,
      rating: reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0,
      reviewCount: reviews.length,
      bestsellers,
      byHour: hourBuckets(inRange),
      byDay: days,
    };
  }
  return apiFetch(`/cafeteria/stats?range=${range}`);
}
