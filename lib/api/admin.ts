import { DEMO_USERS, LEDGER, PEAK_HOURS, PENDING_APPLICATIONS } from "../mock-data/campus";
import type { VerificationApplication, VerificationStatus } from "../types";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

export async function getLedger() {
  if (USE_MOCKS) {
    await delay();
    return LEDGER;
  }
  return apiFetch("/admin/ledger");
}

export async function getPeakHours() {
  if (USE_MOCKS) {
    await delay();
    return PEAK_HOURS;
  }
  return apiFetch("/admin/analytics/peak");
}

export type SystemLog = { id: string; level: string; msg: string; at: string };

export async function getLogs(): Promise<SystemLog[]> {
  if (USE_MOCKS) {
    await delay();
    return [
      { id: "log1", level: "info", msg: "Queue broadcast Central Canteen → 14", at: "12:11 PM" },
      { id: "log2", level: "warn", msg: "Stock low: Egg Hopper Pair (0)", at: "11:58 AM" },
      { id: "log3", level: "info", msg: "Courier Kasun D. accepted job_3", at: "11:44 AM" },
      { id: "log4", level: "ok", msg: "Wallet top-up Rs. 2,000 settled", at: "9:12 AM" },
    ];
  }
  return apiFetch<SystemLog[]>("/admin/logs");
}

export async function listPendingApprovals(): Promise<VerificationApplication[]> {
  if (USE_MOCKS) {
    await delay();
    return [...PENDING_APPLICATIONS];
  }
  return apiFetch<VerificationApplication[]>("/admin/approvals");
}

export async function reviewApplication(id: string, status: Exclude<VerificationStatus, "pending">) {
  if (USE_MOCKS) {
    await delay();
    const application = PENDING_APPLICATIONS.find((item) => item.id === id);
    if (application) {
      application.verificationStatus = status;
      const user = DEMO_USERS.find((item) => item.id === application.userId);
      if (user) {
        user.verificationStatus = status;
      } else if (status === "approved") {
        DEMO_USERS.push({
          id: application.userId,
          name: application.name,
          email: application.email,
          role: application.role,
          campusId: application.idNumber || application.userId,
          customerSubRole: application.customerSubRole,
          idNumber: application.idNumber,
          verificationStatus: status,
          verificationDocName: application.documents[0]?.name,
          verificationDocUrl: application.documents[0]?.url,
        });
      }
    }
    return application ?? null;
  }
  return apiFetch<VerificationApplication>(`/admin/approvals/${id}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
