/**
 * Browser-persisted mock database for the J Eats demo.
 *
 * Only the mock branches of `lib/api/*` touch this module. UI components must go
 * through the API services so the app can switch to the Flask REST API by setting
 * NEXT_PUBLIC_USE_MOCKS=false.
 */
import {
  DEMO_USERS,
  JOBS,
  LEDGER,
  MENU,
  PENDING_APPLICATIONS,
  REVIEWS,
  STALLS,
  VENDORS,
  WALLET_TXNS,
} from "../mock-data/campus";
import type {
  CourierJob,
  LedgerEntry,
  MenuItem,
  Notification,
  Order,
  OrderStatus,
  PlatformSettings,
  Review,
  Stall,
  SystemLog,
  User,
  Vendor,
  VerificationApplication,
  Wallet,
} from "../types";

export const DB_KEY = "jeats-mockdb-v1";
export const DB_EVENT = "jeats:db";
const DB_VERSION = 3;

export type DbUser = User & { password?: string; createdAt?: string };

export type MockDb = {
  version: number;
  seededAt: string;
  users: DbUser[];
  applications: VerificationApplication[];
  vendors: Vendor[];
  menu: MenuItem[];
  reviews: Review[];
  orders: Order[];
  jobs: CourierJob[];
  wallets: Record<string, Wallet>;
  ledger: LedgerEntry[];
  notifications: Notification[];
  logs: SystemLog[];
  queues: Record<string, number>;
  stalls: Stall[];
  settings: PlatformSettings;
  riderOnline: Record<string, boolean>;
  favourites: Record<string, string[]>;
  counters: { order: number; ref: number };
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  deliveryFee: 100,
  riderPayout: 150,
  cashCutoffHour: 11,
  orderingOpen: true,
  maxActiveJobsPerRider: 1,
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Deterministic pseudo-random generator so the seed looks the same every reset. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function isoAt(daysAgo: number, hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function dateOnly(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TIMELINE_ORDER: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];

function timelineUpTo(status: OrderStatus, createdAt: string, fulfillment: "pickup" | "delivery") {
  const start = new Date(createdAt).getTime();
  const steps = TIMELINE_ORDER.filter((s) => fulfillment === "delivery" || s !== "out_for_delivery");
  if (status === "cancelled") {
    return [
      { status: "placed" as OrderStatus, at: createdAt },
      { status: "cancelled" as OrderStatus, at: new Date(start + 4 * 60_000).toISOString() },
    ];
  }
  const idx = steps.indexOf(status);
  return steps.slice(0, idx + 1).map((s, i) => ({ status: s, at: new Date(start + i * 6 * 60_000).toISOString() }));
}

function buildSeed(): MockDb {
  const menu = clone(MENU);
  const vendors = clone(VENDORS);
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "Campus vendor";
  const item = (id: string) => menu.find((m) => m.id === id)!;

  const users: DbUser[] = clone(DEMO_USERS).map((u) => ({ ...u, status: "active" as const }));
  const customers = users.filter((u) => u.role === "customer" && u.verificationStatus === "approved");
  const extraNames = ["Nethmi P.", "Isuru M.", "Sahan R.", "Tharushi K.", "Pasindu L.", "Hiruni S."];

  const orders: Order[] = [];
  const ledger: LedgerEntry[] = clone(LEDGER).map((l, i) => ({ ...l, createdAt: isoAt(i < 2 ? 0 : 1, 9 + i, 12) }));
  const jobs: CourierJob[] = [];
  const random = rng(42);
  let refCounter = 200;

  function mk(o: {
    id: string;
    customerId: string;
    customerName: string;
    lines: { itemId: string; qty: number }[];
    status: OrderStatus;
    fulfillment: "pickup" | "delivery";
    payment: "wallet" | "card" | "cash";
    createdAt: string;
    destination?: string;
    slot?: string;
    preOrder?: boolean;
    scheduledFor?: string;
    courierId?: string;
    cancelReason?: string;
  }) {
    const first = item(o.lines[0].itemId);
    const lines = o.lines.map((l) => {
      const m = item(l.itemId);
      return { itemId: m.id, name: m.name, qty: l.qty, unitPrice: m.price, spice: "medium" as const, image: m.image };
    });
    const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
    const deliveryFee = o.fulfillment === "delivery" ? DEFAULT_SETTINGS.deliveryFee : 0;
    const order: Order = {
      id: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      vendorId: first.vendorId,
      vendorName: vendorName(first.vendorId),
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.unitPrice * l.qty })),
      lines,
      total: subtotal + deliveryFee,
      deliveryFee,
      status: o.status,
      fulfillment: o.fulfillment,
      payment: o.payment,
      placedAt: o.createdAt,
      createdAt: o.createdAt,
      pickupPoint: o.fulfillment === "pickup" ? vendorName(first.vendorId) : o.destination,
      destination: o.destination ?? (o.fulfillment === "pickup" ? vendorName(first.vendorId) : "Library pickup zone"),
      slot: o.slot,
      preOrder: o.preOrder,
      scheduledFor: o.scheduledFor,
      courierId: o.courierId,
      courierName: o.courierId ? users.find((u) => u.id === o.courierId)?.name : undefined,
      cancelReason: o.cancelReason,
      paymentRef: `PAY-${refCounter}`,
      paymentStatus:
        o.status === "cancelled" ? (o.payment === "cash" ? "pending" : "refunded") : o.payment === "cash" ? "pending" : "paid",
      timeline: timelineUpTo(o.status, o.createdAt, o.fulfillment),
      reviewed: false,
    };
    refCounter += 1;
    orders.push(order);
    if (o.status !== "cancelled" && o.payment !== "cash") {
      ledger.push({
        id: `l_${order.id}`,
        ref: order.id,
        party: order.customerName,
        amount: order.total,
        type: "sale",
        at: o.createdAt,
        createdAt: o.createdAt,
      });
    }
    return order;
  }

  // Historical, completed orders across the last 7 days (feeds analytics).
  const vendorMenus = menu.filter((m) => m.stock > 0);
  for (let i = 0; i < 34; i += 1) {
    const day = Math.floor(random() * 7);
    const hour = [8, 9, 10, 11, 11, 12, 12, 12, 13, 13, 14, 15, 16, 17][Math.floor(random() * 14)];
    const pick = vendorMenus[Math.floor(random() * vendorMenus.length)];
    const useAccount = random() < 0.45;
    const cust = useAccount ? customers[Math.floor(random() * customers.length)] : null;
    const fulfillment = random() < 0.5 ? "delivery" : "pickup";
    const cancelled = random() < 0.07;
    const createdAt = isoAt(day === 0 ? 1 : day, hour, Math.floor(random() * 59));
    const riderId = random() < 0.7 ? "u_cou" : "u_cou_2";
    mk({
      id: `JE-${1000 + i}`,
      customerId: cust?.id ?? `guest_${i}`,
      customerName: cust ? cust.name : extraNames[i % extraNames.length],
      lines: [{ itemId: pick.id, qty: 1 + Math.floor(random() * 2) }],
      status: cancelled ? "cancelled" : "delivered",
      fulfillment,
      payment: random() < 0.6 ? "wallet" : "card",
      createdAt,
      courierId: !cancelled && fulfillment === "delivery" ? riderId : undefined,
      destination: fulfillment === "delivery" ? ["Library steps", "Hostel Block C", "Gate 2 · Faculty entrance", "Faculty of Management"][i % 4] : undefined,
      cancelReason: cancelled ? "Customer schedule changed" : undefined,
    }).reviewed = random() < 0.5;
  }

  // A few orders delivered earlier today so "today" dashboards are not empty.
  [
    { id: "JE-1034", c: "u_cus_ac", n: "Dr. Anika Fernando", it: "m_rolls", h: 8, f: "delivery" as const, r: "u_cou" },
    { id: "JE-1035", c: "guest_a", n: "Sahan R.", it: "m_rice_curry", h: 9, f: "pickup" as const },
    { id: "JE-1036", c: "u_cus", n: "Mira Sen", it: "m_kottu", h: 10, f: "delivery" as const, r: "u_cou" },
    { id: "JE-1037", c: "u_cus_na", n: "Ruwan Silva", it: "m_choco", h: 10, f: "pickup" as const },
  ].forEach((x) =>
    mk({
      id: x.id,
      customerId: x.c,
      customerName: x.n,
      lines: [{ itemId: x.it, qty: 1 }],
      status: "delivered",
      fulfillment: x.f,
      payment: "wallet",
      createdAt: isoAt(0, Math.min(x.h, new Date().getHours()), 5),
      courierId: x.r,
      destination: x.f === "delivery" ? "Library steps" : undefined,
    }),
  );

  // Live orders in every stage of the pipeline.
  mk({
    id: "JE-1038",
    customerId: "guest_isuru",
    customerName: "Isuru M.",
    lines: [{ itemId: "m_kottu", qty: 2 }],
    status: "ready",
    fulfillment: "delivery",
    payment: "card",
    createdAt: minutesAgo(34),
    destination: "Gate 2 · Faculty entrance",
  });
  mk({
    id: "JE-1039",
    customerId: "u_cus_ac",
    customerName: "Dr. Anika Fernando",
    lines: [{ itemId: "m_rolls", qty: 2 }, { itemId: "m_choco", qty: 1 }],
    status: "ready",
    fulfillment: "delivery",
    payment: "wallet",
    createdAt: minutesAgo(28),
    destination: "Hostel Block C",
  });
  mk({
    id: "JE-1040",
    customerId: "guest_tharushi",
    customerName: "Tharushi K.",
    lines: [{ itemId: "m_rice_curry", qty: 1 }],
    status: "ready",
    fulfillment: "delivery",
    payment: "wallet",
    createdAt: minutesAgo(40),
    destination: "Library steps",
    courierId: "u_cou_2",
  });
  mk({
    id: "JE-1042",
    customerId: "u_cus",
    customerName: "Mira Sen",
    lines: [{ itemId: "m_rice_curry", qty: 1 }],
    status: "preparing",
    fulfillment: "pickup",
    payment: "wallet",
    createdAt: minutesAgo(12),
  });
  mk({
    id: "JE-1043",
    customerId: "u_cus",
    customerName: "Mira Sen",
    lines: [{ itemId: "m_kottu", qty: 1 }],
    status: "placed",
    fulfillment: "pickup",
    payment: "wallet",
    createdAt: minutesAgo(180),
    slot: "12:30",
    preOrder: true,
    scheduledFor: dateOnly(1),
  });
  mk({
    id: "JE-1044",
    customerId: "u_cus_na",
    customerName: "Ruwan Silva",
    lines: [{ itemId: "m_rice_curry", qty: 2 }],
    status: "placed",
    fulfillment: "delivery",
    payment: "card",
    createdAt: minutesAgo(3),
    destination: "Faculty of Management",
  });

  // Courier jobs linked to the ready delivery orders (seed JOBS keep their ids).
  const jobOrder: Record<string, string> = { job_1: "JE-1038", job_2: "JE-1039", job_3: "JE-1040" };
  clone(JOBS).forEach((j) => {
    const order = orders.find((o) => o.id === jobOrder[j.id])!;
    const job: CourierJob = {
      ...j,
      from: order.vendorName ?? j.from,
      to: order.destination ?? j.to,
      items: order.items.reduce((n, i) => n + i.qty, 0),
      orderId: order.id,
      customerName: order.customerName,
      courierId: j.status === "accepted" ? "u_cou_2" : undefined,
      createdAt: order.createdAt,
      declinedBy: [],
    };
    order.jobId = job.id;
    jobs.push(job);
  });
  // Completed jobs for historical delivery orders (rider earnings history).
  orders
    .filter((o) => o.status === "delivered" && o.fulfillment === "delivery" && o.courierId)
    .forEach((o, i) => {
      const completedAt = new Date(new Date(o.createdAt!).getTime() + 32 * 60_000).toISOString();
      jobs.push({
        id: `job_h${i}`,
        from: o.vendorName ?? "Central Canteen",
        to: o.destination ?? "Library steps",
        payout: DEFAULT_SETTINGS.riderPayout,
        distanceM: 400 + ((i * 137) % 600),
        items: o.items.reduce((n, x) => n + x.qty, 0),
        status: "delivered",
        orderId: o.id,
        courierId: o.courierId,
        customerName: o.customerName,
        createdAt: o.createdAt,
        completedAt,
        declinedBy: [],
      });
      o.jobId = `job_h${i}`;
    });

  // Wallets.
  const wallets: Record<string, Wallet> = {};
  users.forEach((u) => {
    if (u.role === "customer") wallets[u.id] = { userId: u.id, balance: 1500, txns: [] };
    if (u.role === "courier") wallets[u.id] = { userId: u.id, balance: 0, txns: [] };
  });
  wallets.u_cus = {
    userId: "u_cus",
    balance: 2500,
    txns: clone(WALLET_TXNS)
      .filter((t) => t.id !== "w3")
      .map((t, i) => ({
        ...t,
        kind: t.type === "credit" ? ("topup" as const) : ("payment" as const),
        createdAt: isoAt(i === 0 ? 0 : 1, i === 0 ? 9 : 13, 4),
      })),
  };
  Object.values(wallets)
    .filter((w) => users.find((u) => u.id === w.userId)?.role === "courier")
    .forEach((w) => {
      jobs
        .filter((j) => j.courierId === w.userId && j.status === "delivered")
        .forEach((j) => {
          w.balance += j.payout;
          w.txns.unshift({
            id: `w_${j.id}`,
            label: `Delivery payout · ${j.orderId}`,
            amount: j.payout,
            type: "credit",
            kind: "earning",
            ref: j.orderId,
            at: j.completedAt!,
            createdAt: j.completedAt,
          });
        });
      w.txns.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    });

  const reviews: Review[] = clone(REVIEWS).map((r, i) => ({ ...r, createdAt: isoAt(r.daysAgo, 13, 10 + i) }));
  [
    { itemId: "m_kottu", author: "Isuru M.", rating: 5, body: "Cheese pull for days. Worth the wait at lunch.", d: 3 },
    { itemId: "m_rolls", author: "Hiruni S.", rating: 4, body: "Crispy and quick — perfect between lectures.", d: 5 },
    { itemId: "m_choco", author: "Pasindu L.", rating: 5, body: "Best cold drink on campus, hands down.", d: 1 },
  ].forEach((r, i) =>
    reviews.push({
      id: `r_seed_${i}`,
      itemId: r.itemId,
      author: r.author,
      rating: r.rating,
      body: r.body,
      daysAgo: r.d,
      verified: true,
      createdAt: isoAt(r.d, 12, 30),
    }),
  );

  const notifications: Notification[] = [
    {
      id: "n1",
      title: "Order JE-1042",
      body: "Central Canteen started preparing your rice & curry.",
      at: minutesAgo(2),
      createdAt: minutesAgo(2),
      read: false,
      userId: "u_cus",
      href: "/customer/track?id=JE-1042",
    },
    {
      id: "n2",
      title: "New order JE-1044",
      body: "Ruwan Silva · 2× Campus Chicken Rice & Curry · delivery",
      at: minutesAgo(3),
      createdAt: minutesAgo(3),
      read: false,
      role: "cafeteria",
      userId: "u_caf",
      href: "/cafeteria/orders",
    },
    {
      id: "n3",
      title: "2 delivery jobs available",
      body: "Central Canteen and Faculty Café have orders ready for pickup.",
      at: minutesAgo(20),
      createdAt: minutesAgo(20),
      read: false,
      role: "courier",
      href: "/courier/jobs",
    },
    {
      id: "n4",
      title: "Applications awaiting review",
      body: "New customer, rider and cafeteria documents were submitted.",
      at: minutesAgo(30),
      createdAt: minutesAgo(30),
      read: false,
      role: "admin",
      href: "/admin#pending-approvals",
    },
  ];

  const logs: SystemLog[] = [
    { id: "log1", level: "info", msg: "Queue broadcast Central Canteen → 14", at: minutesAgo(45), createdAt: minutesAgo(45) },
    { id: "log2", level: "warn", msg: "Stock low: Egg Hopper Pair (0)", at: minutesAgo(60), createdAt: minutesAgo(60) },
    { id: "log3", level: "info", msg: "Rider Dilan W. accepted job_3 (JE-1040)", at: minutesAgo(38), createdAt: minutesAgo(38) },
    { id: "log4", level: "ok", msg: "Wallet top-up Rs. 2,000 settled", at: isoAt(0, 9, 12), createdAt: isoAt(0, 9, 12) },
  ];

  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    users,
    applications: clone(PENDING_APPLICATIONS),
    vendors,
    menu,
    reviews,
    orders: orders.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    jobs,
    wallets,
    ledger: ledger.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    notifications,
    logs,
    queues: { v_cc: 14, v_fc: 6, v_bl: 9, v_ss: 4, v_gb: 3 },
    stalls: clone(STALLS),
    settings: { ...DEFAULT_SETTINGS },
    riderOnline: { u_cou: true, u_cou_2: true },
    favourites: { u_cus: ["m_rice_curry"] },
    counters: { order: 1045, ref: refCounter },
  };
}

let cache: MockDb | null = null;
const isBrowser = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

function load(): MockDb {
  if (!isBrowser()) return buildSeed();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed?.version === DB_VERSION) return parsed;
    }
  } catch {
    // Corrupt or blocked storage: fall back to a fresh seed.
  }
  const seed = buildSeed();
  persist(seed);
  return seed;
}

function persist(db: MockDb) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded (large document previews): drop inline previews and retry once.
    try {
      db.applications.forEach((a) => a.documents.forEach((d) => (d.url = d.url.startsWith("data:") ? "" : d.url)));
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      // Keep working in memory for this session.
    }
  }
}

/** Read a snapshot. Treat the result as read-only; use `writeDb` to change data. */
export function readDb(): MockDb {
  if (!cache) cache = load();
  return cache;
}

/** Apply a mutation, persist it and notify every subscribed view (this tab and others). */
export function writeDb<T>(mutate: (db: MockDb) => T): T {
  const db = readDb();
  const result = mutate(db);
  persist(db);
  if (isBrowser()) window.dispatchEvent(new Event(DB_EVENT));
  return result;
}

export function resetDb() {
  cache = buildSeed();
  persist(cache);
  if (isBrowser()) window.dispatchEvent(new Event(DB_EVENT));
}

export function nextOrderId(db: MockDb) {
  const id = `JE-${db.counters.order}`;
  db.counters.order += 1;
  return id;
}

export function nextRef(db: MockDb, prefix: string) {
  const id = `${prefix}-${db.counters.ref}`;
  db.counters.ref += 1;
  return id;
}

if (isBrowser()) {
  // Another tab changed the demo data: drop the cache and refresh subscribers.
  window.addEventListener("storage", (event) => {
    if (event.key === DB_KEY) {
      cache = null;
      window.dispatchEvent(new Event(DB_EVENT));
    }
  });
}
