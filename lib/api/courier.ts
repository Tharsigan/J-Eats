import { readDb, writeDb, type MockDb } from "../mock-db/db";
import { addLedger, logEvent, notify, notifyVendor, walletFor, walletTxn } from "../mock-db/events";
import type { CourierJob, Order } from "../types";
import { delay, formatRs } from "../utils";
import { ApiError, apiFetch, requireSession, USE_MOCKS } from "./client";

const ACTIVE_JOB: CourierJob["status"][] = ["accepted", "picked"];

function me(db: MockDb) {
  const { userId } = requireSession();
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.role !== "courier") throw new ApiError(403, "Rider access only.");
  return user;
}

export type JobView = CourierJob & { order?: Order };

function withOrder(db: MockDb, job: CourierJob): JobView {
  return { ...job, order: db.orders.find((o) => o.id === job.orderId) };
}

/** Open jobs the rider has not declined, plus the rider's own jobs. */
export async function listJobs(): Promise<JobView[]> {
  if (USE_MOCKS) {
    await delay(120);
    const db = readDb();
    const rider = me(db);
    const online = db.riderOnline[rider.id] ?? true;
    return db.jobs
      .filter(
        (j) =>
          j.courierId === rider.id ||
          (online && j.status === "open" && !(j.declinedBy ?? []).includes(rider.id)),
      )
      .map((j) => withOrder(db, j))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  return apiFetch("/courier/jobs");
}

export async function getActiveJob(): Promise<JobView | null> {
  if (USE_MOCKS) {
    const db = readDb();
    const rider = me(db);
    const job = db.jobs.find((j) => j.courierId === rider.id && ACTIVE_JOB.includes(j.status));
    return job ? withOrder(db, job) : null;
  }
  return apiFetch("/courier/jobs/active");
}

export async function acceptJob(id: string): Promise<CourierJob | undefined> {
  if (USE_MOCKS) {
    await delay(250);
    return writeDb((db) => {
      const rider = me(db);
      if (!(db.riderOnline[rider.id] ?? true)) throw new ApiError(409, "Go online before accepting jobs.");
      const active = db.jobs.filter((j) => j.courierId === rider.id && ACTIVE_JOB.includes(j.status)).length;
      if (active >= db.settings.maxActiveJobsPerRider) {
        throw new ApiError(409, "Finish your active delivery before accepting another job.");
      }
      const job = db.jobs.find((j) => j.id === id);
      if (!job || job.status !== "open") throw new ApiError(409, "This job was already taken by another rider.");
      job.status = "accepted";
      job.courierId = rider.id;
      const order = db.orders.find((o) => o.id === job.orderId);
      if (order) {
        order.courierId = rider.id;
        order.courierName = rider.name;
        if (order.customerId) {
          notify(db, { userId: order.customerId }, `Rider assigned · ${order.id}`, `${rider.name} is heading to ${job.from}.`, `/customer/track?id=${order.id}`);
        }
        notifyVendor(db, order.vendorId, `Rider for ${order.id}`, `${rider.name} accepted the delivery and is on the way.`, "/cafeteria/orders");
      }
      logEvent(db, "info", `Rider ${rider.name} accepted ${job.id}${job.orderId ? ` (${job.orderId})` : ""}`);
      return { ...job };
    });
  }
  return apiFetch(`/courier/jobs/${id}/accept`, { method: "POST" });
}

export async function declineJob(id: string): Promise<{ ok: boolean }> {
  if (USE_MOCKS) {
    await delay(120);
    return writeDb((db) => {
      const rider = me(db);
      const job = db.jobs.find((j) => j.id === id);
      if (!job) throw new ApiError(404, "Job not found.");
      job.declinedBy = [...new Set([...(job.declinedBy ?? []), rider.id])];
      logEvent(db, "info", `Rider ${rider.name} declined ${job.id}`);
      return { ok: true };
    });
  }
  return apiFetch(`/courier/jobs/${id}/decline`, { method: "POST" });
}

/** Rider collected the food from the counter → order is out for delivery. */
export async function pickUpJob(id: string): Promise<CourierJob> {
  if (USE_MOCKS) {
    await delay(200);
    return writeDb((db) => {
      const rider = me(db);
      const job = db.jobs.find((j) => j.id === id && j.courierId === rider.id);
      if (!job || job.status !== "accepted") throw new ApiError(409, "Accept the job before picking it up.");
      job.status = "picked";
      const order = db.orders.find((o) => o.id === job.orderId);
      if (order) {
        const at = new Date().toISOString();
        order.status = "out_for_delivery";
        order.timeline = [...(order.timeline ?? []), { status: "out_for_delivery", at }];
        if (order.customerId) {
          notify(db, { userId: order.customerId }, `On the way · ${order.id}`, `${rider.name} collected your food from ${job.from}.`, `/customer/track?id=${order.id}`);
        }
      }
      logEvent(db, "info", `Order ${job.orderId} collected by ${rider.name}`);
      return { ...job };
    });
  }
  return apiFetch(`/courier/jobs/${id}/pickup`, { method: "POST" });
}

/** Drop-off confirmed → order delivered and the rider is paid the job payout. */
export async function completeJob(id: string): Promise<CourierJob> {
  if (USE_MOCKS) {
    await delay(250);
    return writeDb((db) => {
      const rider = me(db);
      const job = db.jobs.find((j) => j.id === id && j.courierId === rider.id);
      if (!job || job.status !== "picked") throw new ApiError(409, "Pick up the order before marking it delivered.");
      const at = new Date().toISOString();
      job.status = "delivered";
      job.completedAt = at;
      const order = db.orders.find((o) => o.id === job.orderId);
      if (order) {
        order.status = "delivered";
        order.timeline = [...(order.timeline ?? []), { status: "delivered", at }];
        if (order.payment === "cash") order.paymentStatus = "paid";
        if (order.customerId) {
          notify(db, { userId: order.customerId }, `Delivered · ${order.id}`, "Enjoy your meal! Tap to rate your food.", "/customer/profile");
        }
        notifyVendor(db, order.vendorId, `Delivered · ${order.id}`, `${rider.name} completed the drop-off.`, "/cafeteria/orders");
      }
      walletTxn(db, rider.id, {
        label: `Delivery payout · ${job.orderId ?? job.id}`,
        amount: job.payout,
        type: "credit",
        kind: "earning",
        ref: job.orderId,
      });
      addLedger(db, { ref: job.orderId ?? job.id, party: rider.name, amount: job.payout, type: "payout" });
      notify(db, { userId: rider.id }, "Payout credited", `${formatRs(job.payout)} for ${job.orderId ?? job.id}.`, "/courier/earnings");
      logEvent(db, "ok", `Order ${job.orderId} delivered by ${rider.name} · payout ${formatRs(job.payout)}`);
      return { ...job };
    });
  }
  return apiFetch(`/courier/jobs/${id}/complete`, { method: "POST" });
}

export async function getOnline(): Promise<boolean> {
  if (USE_MOCKS) {
    const db = readDb();
    return db.riderOnline[me(db).id] ?? true;
  }
  return apiFetch("/courier/status");
}

export async function setOnline(online: boolean): Promise<boolean> {
  if (USE_MOCKS) {
    return writeDb((db) => {
      const rider = me(db);
      db.riderOnline[rider.id] = online;
      logEvent(db, "info", `Rider ${rider.name} is ${online ? "online" : "offline"}`);
      return online;
    });
  }
  return apiFetch("/courier/status", { method: "POST", body: JSON.stringify({ online }) });
}

export type RiderStats = {
  today: number;
  todayCount: number;
  week: number;
  weekCount: number;
  balance: number;
  history: JobView[];
};

export async function getRiderStats(): Promise<RiderStats> {
  if (USE_MOCKS) {
    await delay(80);
    const db = readDb();
    const rider = me(db);
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startWeek = startToday.getTime() - 6 * 86_400_000;
    const done = db.jobs.filter((j) => j.courierId === rider.id && j.status === "delivered");
    const since = (t: number) => done.filter((j) => new Date(j.completedAt ?? 0).getTime() >= t);
    const today = since(startToday.getTime());
    const week = since(startWeek);
    return {
      today: today.reduce((n, j) => n + j.payout, 0),
      todayCount: today.length,
      week: week.reduce((n, j) => n + j.payout, 0),
      weekCount: week.length,
      balance: walletFor(db, rider.id).balance,
      history: db.jobs
        .filter((j) => j.courierId === rider.id || (j.declinedBy ?? []).includes(rider.id))
        .map((j) => withOrder(db, j))
        .sort((a, b) => (b.completedAt ?? b.createdAt ?? "").localeCompare(a.completedAt ?? a.createdAt ?? "")),
    };
  }
  return apiFetch("/courier/stats");
}

/** Simulated weekly settlement: moves the rider wallet balance out to a bank payout. */
export async function withdrawEarnings(): Promise<{ amount: number }> {
  if (USE_MOCKS) {
    await delay(350);
    return writeDb((db) => {
      const rider = me(db);
      const wallet = walletFor(db, rider.id);
      if (wallet.balance <= 0) throw new ApiError(400, "No earnings available to withdraw.");
      const amount = wallet.balance;
      walletTxn(db, rider.id, { label: "Withdrawal · simulated bank transfer", amount, type: "debit", kind: "withdrawal" });
      logEvent(db, "ok", `Rider ${rider.name} withdrew ${formatRs(amount)} (simulated)`);
      return { amount };
    });
  }
  return apiFetch("/courier/withdraw", { method: "POST" });
}
