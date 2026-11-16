import type { LedgerEntry, Role, SystemLog, WalletTxn } from "../types";
import { uid } from "../utils";
import type { MockDb } from "./db";

const now = () => new Date().toISOString();

/** Queue an in-app notification for one user, or for every user of a role. */
export function notify(
  db: MockDb,
  target: { userId?: string; role?: Role },
  title: string,
  body: string,
  href?: string,
) {
  const at = now();
  db.notifications.unshift({ id: uid("n"), title, body, at, createdAt: at, read: false, href, ...target });
  db.notifications = db.notifications.slice(0, 300);
}

export function logEvent(db: MockDb, level: SystemLog["level"], msg: string) {
  const at = now();
  db.logs.unshift({ id: uid("log"), level, msg, at, createdAt: at });
  db.logs = db.logs.slice(0, 300);
}

export function addLedger(db: MockDb, entry: Omit<LedgerEntry, "id" | "at" | "createdAt">) {
  const at = now();
  db.ledger.unshift({ ...entry, id: uid("l"), at, createdAt: at });
}

export function walletFor(db: MockDb, userId: string) {
  if (!db.wallets[userId]) db.wallets[userId] = { userId, balance: 0, txns: [] };
  return db.wallets[userId];
}

export function walletTxn(
  db: MockDb,
  userId: string,
  txn: Omit<WalletTxn, "id" | "at" | "createdAt">,
) {
  const wallet = walletFor(db, userId);
  const at = now();
  wallet.balance += txn.type === "credit" ? txn.amount : -txn.amount;
  wallet.txns.unshift({ ...txn, id: uid("w"), at, createdAt: at });
  return wallet;
}

export function cafeteriaUsersFor(db: MockDb, vendorId?: string) {
  return db.users.filter((u) => u.role === "cafeteria" && u.vendorId === vendorId);
}

/** Notify everyone who operates a vendor. */
export function notifyVendor(db: MockDb, vendorId: string | undefined, title: string, body: string, href?: string) {
  cafeteriaUsersFor(db, vendorId).forEach((u) => notify(db, { userId: u.id }, title, body, href));
}
