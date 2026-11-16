import { readDb, writeDb } from "../mock-db/db";
import { logEvent, notifyVendor } from "../mock-db/events";
import type { MenuItem, Review, TimeSlot, Vendor } from "../types";
import { delay, uid } from "../utils";
import { ApiError, apiFetch, currentSession, requireSession, USE_MOCKS } from "./client";

export async function listMenu(): Promise<MenuItem[]> {
  if (USE_MOCKS) {
    await delay(120);
    return [...readDb().menu];
  }
  return apiFetch("/menu");
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  if (USE_MOCKS) {
    await delay(60);
    return readDb().menu.find((m) => m.id === id || m.slug === id);
  }
  return apiFetch(`/menu/${id}`);
}

export async function listVendors(): Promise<(Vendor & { queue: number })[]> {
  if (USE_MOCKS) {
    const db = readDb();
    return db.vendors.map((v) => ({ ...v, queue: db.queues[v.id] ?? 0 }));
  }
  return apiFetch("/vendors");
}

export async function getVendor(id: string): Promise<Vendor | undefined> {
  if (USE_MOCKS) {
    return readDb().vendors.find((v) => v.id === id);
  }
  return apiFetch(`/vendors/${id}`);
}

export async function listReviews(itemId?: string): Promise<Review[]> {
  if (USE_MOCKS) {
    await delay(60);
    const reviews = readDb().reviews.filter((r) => !itemId || r.itemId === itemId);
    return [...reviews].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  return apiFetch(itemId ? `/menu/${itemId}/reviews` : "/reviews");
}

const SLOT_TIMES = ["08:30", "10:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export function slotLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Pickup / delivery slots for a date (yyyy-mm-dd, default today). Past slots and slots
 * that already hold 6+ orders are unavailable.
 */
export async function listSlots(date?: string): Promise<TimeSlot[]> {
  if (USE_MOCKS) {
    await delay(40);
    const db = readDb();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const day = date ?? today;
    return SLOT_TIMES.map((t) => {
      const [h, m] = t.split(":").map(Number);
      const past = day === today && h * 60 + m <= now.getHours() * 60 + now.getMinutes() + 10;
      const booked = db.orders.filter(
        (o) => o.slot === t && (o.scheduledFor ?? today) === day && o.status !== "cancelled" && o.status !== "delivered",
      ).length;
      const full = booked >= 6;
      return {
        id: t,
        label: slotLabel(t),
        hint: past ? "Past" : full ? "Fully booked" : booked ? `${6 - booked} left` : "Available",
        available: !past && !full,
      };
    });
  }
  return apiFetch(`/slots${date ? `?date=${date}` : ""}`);
}

export async function listRelated(itemId: string): Promise<MenuItem[]> {
  if (USE_MOCKS) {
    const menu = readDb().menu;
    const item = menu.find((m) => m.id === itemId);
    return menu
      .filter((m) => m.id !== itemId && m.available)
      .sort((a, b) => Number(b.vendorId === item?.vendorId) - Number(a.vendorId === item?.vendorId) || b.rating - a.rating)
      .slice(0, 3);
  }
  return apiFetch(`/menu/${itemId}/related`);
}

export async function addReview(input: {
  itemId: string;
  rating: number;
  body: string;
  orderId?: string;
}): Promise<Review> {
  if (USE_MOCKS) {
    await delay(200);
    const { userId } = requireSession();
    return writeDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      const item = db.menu.find((m) => m.id === input.itemId);
      if (!user || !item) throw new ApiError(404, "Menu item not found.");
      const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
      if (!input.body.trim()) throw new ApiError(400, "Tell other students a little about the meal.");
      const verified = db.orders.some(
        (o) => o.customerId === userId && o.status === "delivered" && o.lines?.some((l) => l.itemId === item.id),
      );
      const at = new Date().toISOString();
      const parts = user.name.split(" ");
      const review: Review = {
        id: uid("r"),
        itemId: item.id,
        author: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : user.name,
        rating,
        body: input.body.trim(),
        daysAgo: 0,
        verified,
        userId,
        createdAt: at,
      };
      db.reviews.unshift(review);
      // Running average so the menu card rating reflects new feedback immediately.
      item.rating = Math.round(((item.rating * item.reviewCount + rating) / (item.reviewCount + 1)) * 10) / 10;
      item.reviewCount += 1;
      if (input.orderId) {
        const order = db.orders.find((o) => o.id === input.orderId && o.customerId === userId);
        if (order) order.reviewed = true;
      }
      notifyVendor(db, item.vendorId, `New ${rating}★ review`, `${review.author} on ${item.name}: “${review.body.slice(0, 60)}”`, "/cafeteria");
      logEvent(db, "info", `${review.author} rated ${item.name} ${rating}/5`);
      return review;
    });
  }
  return apiFetch(`/menu/${input.itemId}/reviews`, { method: "POST", body: JSON.stringify(input) });
}

export async function listFavourites(): Promise<string[]> {
  if (USE_MOCKS) {
    const session = currentSession();
    if (!session) return [];
    return readDb().favourites[session.userId] ?? [];
  }
  return apiFetch("/favourites");
}

export async function toggleFavourite(itemId: string): Promise<string[]> {
  if (USE_MOCKS) {
    const session = currentSession();
    if (!session) throw new ApiError(401, "Sign in to save favourites.");
    return writeDb((db) => {
      const list = db.favourites[session.userId] ?? [];
      db.favourites[session.userId] = list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId];
      return db.favourites[session.userId];
    });
  }
  return apiFetch(`/favourites/${itemId}`, { method: "POST" });
}
