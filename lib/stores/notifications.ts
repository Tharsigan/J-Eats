"use client";

import { create } from "zustand";
import type { Notification } from "../types";
import { uid } from "../utils";

/**
 * Short-lived toast messages for instant feedback (added to cart, saved, …).
 * Persistent, per-user notifications live in `lib/api/notifications.ts`.
 */
type NotifyState = {
  items: Notification[];
  push: (title: string, body: string, tone?: "ok" | "error") => void;
  markRead: (id: string) => void;
};

export const useNotifyStore = create<NotifyState>((set) => ({
  items: [],
  push: (title, body, tone = "ok") => {
    const id = uid("t");
    set((s) => ({
      items: [{ id, title, body, at: tone, read: false }, ...s.items].slice(0, 4),
    }));
    setTimeout(() => set((s) => ({ items: s.items.filter((n) => n.id !== id) })), 3500);
  },
  markRead: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
}));
