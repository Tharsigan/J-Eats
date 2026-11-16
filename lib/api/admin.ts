import { readDb, resetDb, writeDb } from "../mock-db/db";
import { logEvent, notify } from "../mock-db/events";
import type {
  LedgerEntry,
  Order,
  PlatformSettings,
  Role,
  SystemLog,
  User,
  VerificationApplication,
  VerificationStatus,
} from "../types";
import { delay, formatRs, uid } from "../utils";
import { ApiError, apiFetch, USE_MOCKS } from "./client";
import { hourBuckets, rangeStart, type StatsRange } from "./cafeteria";

export type { SystemLog };

export async function getLedger(type?: LedgerEntry["type"] | "all"): Promise<LedgerEntry[]> {
  if (USE_MOCKS) {
    await delay(120);
    const ledger = readDb().ledger;
    return ledger.filter((l) => !type || type === "all" || l.type === type);
  }
  return apiFetch(`/admin/ledger${type && type !== "all" ? `?type=${type}` : ""}`);
}

export async function getPeakHours(range: StatsRange = "week"): Promise<{ hour: string; value: number }[]> {
  if (USE_MOCKS) {
    await delay(80);
    const from = rangeStart(range);
    return hourBuckets(readDb().orders.filter((o) => new Date(o.createdAt ?? 0).getTime() >= from));
  }
  return apiFetch(`/admin/analytics/peak?range=${range}`);
}

export async function getLogs(): Promise<SystemLog[]> {
  if (USE_MOCKS) {
    await delay(80);
    return [...readDb().logs];
  }
  return apiFetch<SystemLog[]>("/admin/logs");
}

export async function listPendingApprovals(): Promise<VerificationApplication[]> {
  if (USE_MOCKS) {
    await delay(100);
    return [...readDb().applications].sort((a, b) => {
      const pa = a.verificationStatus === "pending" ? 0 : 1;
      const pb = b.verificationStatus === "pending" ? 0 : 1;
      return pa - pb || b.submittedAt.localeCompare(a.submittedAt);
    });
  }
  return apiFetch<VerificationApplication[]>("/admin/approvals");
}

export async function reviewApplication(
  id: string,
  status: Exclude<VerificationStatus, "pending">,
): Promise<VerificationApplication> {
  if (USE_MOCKS) {
    await delay(250);
    return writeDb((db) => {
      const application = db.applications.find((item) => item.id === id);
      if (!application) throw new ApiError(404, "Application not found.");
      application.verificationStatus = status;
      let user = db.users.find((item) => item.id === application.userId);
      if (!user && status === "approved") {
        user = {
          id: application.userId,
          name: application.name,
          email: application.email,
          role: application.role,
          campusId: application.idNumber || application.userId,
          customerSubRole: application.customerSubRole,
          idNumber: application.idNumber,
          verificationDocName: application.documents[0]?.name,
          verificationDocUrl: application.documents[0]?.url,
          status: "active",
        };
        db.users.push(user);
      }
      if (user) {
        user.verificationStatus = status;
        if (status === "approved") {
          if (user.role === "customer" && !db.wallets[user.id]) db.wallets[user.id] = { userId: user.id, balance: 0, txns: [] };
          if (user.role === "courier") {
            if (!db.wallets[user.id]) db.wallets[user.id] = { userId: user.id, balance: 0, txns: [] };
            db.riderOnline[user.id] = true;
          }
          // An approved cafeteria gets its own vendor listing (closed until it adds a menu).
          if (user.role === "cafeteria" && !user.vendorId) {
            const vendorId = uid("v");
            db.vendors.push({
              id: vendorId,
              name: application.name,
              location: application.extra?.replace(/^Owner:.*$/, "") || "University campus",
              distanceKm: 0.5,
              openNow: true,
              closesAt: "6:00 PM",
            });
            db.queues[vendorId] = 0;
            user.vendorId = vendorId;
          }
        }
        notify(
          db,
          { userId: user.id },
          status === "approved" ? "Account approved" : "Verification rejected",
          status === "approved" ? "Welcome to J Eats! You can now sign in." : "Your documents could not be verified.",
        );
      }
      logEvent(
        db,
        status === "approved" ? "ok" : "warn",
        `Admin ${status} ${application.role === "courier" ? "rider" : application.role} application: ${application.name}`,
      );
      return { ...application };
    });
  }
  return apiFetch<VerificationApplication>(`/admin/approvals/${id}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function listUsers(): Promise<User[]> {
  if (USE_MOCKS) {
    await delay(100);
    return readDb().users.map(({ password: _p, ...u }) => {
      void _p;
      return u;
    });
  }
  return apiFetch("/admin/users");
}

export async function setUserStatus(id: string, status: "active" | "suspended"): Promise<User> {
  if (USE_MOCKS) {
    await delay(150);
    return writeDb((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new ApiError(404, "User not found.");
      if (user.role === "admin") throw new ApiError(403, "Administrator accounts cannot be suspended here.");
      user.status = status;
      logEvent(db, status === "suspended" ? "warn" : "ok", `Admin ${status === "suspended" ? "suspended" : "reactivated"} ${user.name} (${user.role})`);
      return { ...user };
    });
  }
  return apiFetch(`/admin/users/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export async function listAllOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await delay(100);
    return [...readDb().orders].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  return apiFetch("/admin/orders");
}

export type PlatformStats = {
  customers: { total: number; student: number; academic: number; nonAcademic: number };
  riders: { approved: number; pending: number; online: number };
  cafeterias: { approved: number; pending: number };
  orders: { total: number; completed: number; active: number; cancelled: number };
  volume: number;
  activeDeliveries: number;
  pendingApplications: { courier: number; cafeteria: number; customer: number };
  byHour: { hour: string; value: number }[];
  byVendor: { name: string; revenue: number; orders: number }[];
  byStatus: { status: string; count: number }[];
};

export async function getPlatformStats(range: StatsRange = "today"): Promise<PlatformStats> {
  if (USE_MOCKS) {
    await delay(100);
    const db = readDb();
    const from = rangeStart(range);
    const orders = db.orders.filter((o) => new Date(o.createdAt ?? 0).getTime() >= from);
    const count = (role: Role, status?: VerificationStatus) =>
      db.users.filter((u) => u.role === role && (!status || (u.verificationStatus ?? "approved") === status)).length;
    const approvedCustomers = db.users.filter((u) => u.role === "customer" && (u.verificationStatus ?? "approved") === "approved");
    const pending = db.applications.filter((a) => a.verificationStatus === "pending");
    const live = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];
    const byVendor = db.vendors
      .map((v) => {
        const vo = orders.filter((o) => o.vendorId === v.id && o.status !== "cancelled");
        return { name: v.name, revenue: vo.reduce((n, o) => n + o.total, 0), orders: vo.length };
      })
      .sort((a, b) => b.revenue - a.revenue);
    const statuses = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
    return {
      customers: {
        total: approvedCustomers.length,
        student: approvedCustomers.filter((u) => u.customerSubRole === "student").length,
        academic: approvedCustomers.filter((u) => u.customerSubRole === "academic").length,
        nonAcademic: approvedCustomers.filter((u) => u.customerSubRole === "non-academic").length,
      },
      riders: {
        approved: count("courier", "approved"),
        pending: count("courier", "pending"),
        online: db.users.filter((u) => u.role === "courier" && u.verificationStatus === "approved" && (db.riderOnline[u.id] ?? true)).length,
      },
      cafeterias: { approved: count("cafeteria", "approved"), pending: count("cafeteria", "pending") },
      orders: {
        total: orders.length,
        completed: orders.filter((o) => o.status === "delivered").length,
        active: db.orders.filter((o) => live.includes(o.status)).length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
      },
      volume: orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0),
      activeDeliveries: db.jobs.filter((j) => j.status === "accepted" || j.status === "picked").length,
      pendingApplications: {
        courier: pending.filter((a) => a.role === "courier").length,
        cafeteria: pending.filter((a) => a.role === "cafeteria").length,
        customer: pending.filter((a) => a.role === "customer").length,
      },
      byHour: hourBuckets(orders),
      byVendor,
      byStatus: statuses.map((status) => ({ status, count: orders.filter((o) => o.status === status).length })),
    };
  }
  return apiFetch(`/admin/stats?range=${range}`);
}

export async function getSettings(): Promise<PlatformSettings> {
  if (USE_MOCKS) {
    return { ...readDb().settings };
  }
  return apiFetch("/admin/settings");
}

export async function saveSettings(next: PlatformSettings): Promise<PlatformSettings> {
  if (USE_MOCKS) {
    await delay(200);
    if (next.deliveryFee < 0 || next.riderPayout < 0) throw new ApiError(400, "Fees cannot be negative.");
    if (next.cashCutoffHour < 0 || next.cashCutoffHour > 23) throw new ApiError(400, "Cash cutoff must be an hour between 0 and 23.");
    return writeDb((db) => {
      const before = db.settings;
      db.settings = { ...next, maxActiveJobsPerRider: Math.max(1, Math.round(next.maxActiveJobsPerRider)) };
      db.menu.forEach((m) => (m.deliveryFrom = db.settings.deliveryFee));
      if (before.orderingOpen !== db.settings.orderingOpen) {
        notify(
          db,
          { role: "customer" },
          db.settings.orderingOpen ? "Ordering is open" : "Ordering paused",
          db.settings.orderingOpen ? "Campus kitchens are taking orders again." : "New orders are paused by campus operations.",
        );
      }
      logEvent(
        db,
        "ok",
        `Settings saved · delivery ${formatRs(db.settings.deliveryFee)} · rider payout ${formatRs(db.settings.riderPayout)} · cash until ${db.settings.cashCutoffHour}:00 · ordering ${db.settings.orderingOpen ? "open" : "paused"}`,
      );
      return { ...db.settings };
    });
  }
  return apiFetch("/admin/settings", { method: "PUT", body: JSON.stringify(next) });
}

/** Restore the original seed data (demo convenience; no backend equivalent needed). */
export async function resetDemoData(): Promise<{ ok: boolean }> {
  if (USE_MOCKS) {
    await delay(200);
    resetDb();
    return { ok: true };
  }
  return apiFetch("/admin/reset", { method: "POST" });
}
