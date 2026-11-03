import { DEMO_USERS } from "../mock-data/campus";
import type { Role, User } from "../types";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

export async function loginAsRole(role: Role): Promise<{ user: User; token: string }> {
  if (USE_MOCKS) {
    await delay();
    const user = DEMO_USERS.find((u) => u.role === role)!;
    return { user, token: `mock.${role}.${user.id}` };
  }
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export async function logoutRemote() {
  if (USE_MOCKS) {
    await delay(80);
    return;
  }
  await apiFetch("/auth/logout", { method: "POST" });
}
