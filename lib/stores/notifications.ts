"use client";

import { create } from "zustand";
import type { Notification } from "../types";
import { uid } from "../utils";

type NotifyState = {
  items: Notification[];
  push: (title: string, body: string) => void;
  markRead: (id: string) => void;
};

export const useNotifyStore = create<NotifyState>((set) => ({
  items: [
    {
      id: "n1",
      title: "Order JE-1042",
      body: "Central Canteen started preparing your rice & curry.",
      at: "2 min ago",
      read: false,
    },
  ],
  push: (title, body) =>
    set((s) => ({
      items: [{ id: uid("n"), title, body, at: "Just now", read: false }, ...s.items],
    })),
  markRead: (id) =>
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
}));
