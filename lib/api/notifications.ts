import { readDb, writeDb, type MockDb } from "../mock-db/db";
import type { Notification } from "../types";
import { apiFetch, currentSession, isLive } from "./client";

function visibleTo(db: MockDb, userId: string, role: string) {
  return db.notifications.filter((n) => n.userId === userId || (!n.userId && n.role === role));
}

function isRead(n: Notification, userId: string) {
  return n.userId ? n.read : (n.readBy ?? []).includes(userId);
}

export async function listNotifications(): Promise<Notification[]> {
  if (!isLive("notifications")) {
    const session = currentSession();
    if (!session) return [];
    const db = readDb();
    return visibleTo(db, session.userId, session.role)
      .slice(0, 40)
      .map((n) => ({ ...n, read: isRead(n, session.userId) }));
  }
  // Signed-out visitors have no notifications (and no token to send).
  if (!currentSession()) return [];
  return apiFetch("/notifications");
}

export async function markNotificationRead(id: string) {
  if (!isLive("notifications")) {
    const session = currentSession();
    if (!session) return;
    writeDb((db) => {
      const n = db.notifications.find((x) => x.id === id);
      if (!n) return;
      if (n.userId) n.read = true;
      else n.readBy = [...new Set([...(n.readBy ?? []), session.userId])];
    });
    return;
  }
  if (!currentSession()) return;
  await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  if (!isLive("notifications")) {
    const session = currentSession();
    if (!session) return;
    writeDb((db) => {
      visibleTo(db, session.userId, session.role).forEach((n) => {
        if (n.userId) n.read = true;
        else n.readBy = [...new Set([...(n.readBy ?? []), session.userId])];
      });
    });
    return;
  }
  if (!currentSession()) return;
  await apiFetch("/notifications/read-all", { method: "POST" });
}
