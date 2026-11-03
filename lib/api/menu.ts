import { MENU, REVIEWS, TIME_SLOTS, VENDORS } from "../mock-data/campus";
import type { MenuItem, Review, TimeSlot, Vendor } from "../types";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

export async function listMenu(): Promise<MenuItem[]> {
  if (USE_MOCKS) {
    await delay();
    return MENU;
  }
  return apiFetch("/menu");
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  if (USE_MOCKS) {
    await delay();
    return MENU.find((m) => m.id === id || m.slug === id);
  }
  return apiFetch(`/menu/${id}`);
}

export async function getVendor(id: string): Promise<Vendor | undefined> {
  if (USE_MOCKS) {
    return VENDORS.find((v) => v.id === id);
  }
  return apiFetch(`/vendors/${id}`);
}

export async function listReviews(itemId: string): Promise<Review[]> {
  if (USE_MOCKS) {
    await delay(120);
    return REVIEWS.filter((r) => r.itemId === itemId);
  }
  return apiFetch(`/menu/${itemId}/reviews`);
}

export async function listSlots(): Promise<TimeSlot[]> {
  if (USE_MOCKS) {
    await delay(80);
    return TIME_SLOTS;
  }
  return apiFetch("/slots");
}

export async function listRelated(itemId: string): Promise<MenuItem[]> {
  if (USE_MOCKS) {
    return MENU.filter((m) => m.id !== itemId).slice(0, 3);
  }
  return apiFetch(`/menu/${itemId}/related`);
}
