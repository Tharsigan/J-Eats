import { DEMO_USERS, PENDING_APPLICATIONS } from "../mock-data/campus";
import type { CustomerSubRole, Role, User, VerificationApplication, VerificationDocument } from "../types";
import { delay, uid } from "../utils";
import { ApiError, apiFetch, USE_MOCKS } from "./client";

export type LoginPayload = {
  role: Role;
  identifier: string;
  password: string;
  customerSubRole?: CustomerSubRole;
};

function matchesIdentifier(user: User, identifier: string) {
  const ident = identifier.trim().toLowerCase();
  return [user.email, user.idNumber, user.campusId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === ident);
}

function fileDocument(formData: FormData, fileKey: string, kindKey: string): VerificationDocument | null {
  const file = formData.get(fileKey);
  if (!(file instanceof File) || file.size === 0) return null;
  const kind = String(formData.get(kindKey) || file.name);
  const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
  return { name: file.name, url, kind };
}

export async function login(payload: LoginPayload): Promise<{ user: User; token: string }> {
  if (USE_MOCKS) {
    await delay();
    if (payload.password.length < 6) {
      throw new ApiError(401, "Invalid email or password. Check your credentials and try again.");
    }
    const user = DEMO_USERS.find((candidate) => {
      if (candidate.role !== payload.role) return false;
      if (payload.role === "customer" && payload.customerSubRole && candidate.customerSubRole !== payload.customerSubRole) {
        return false;
      }
      return matchesIdentifier(candidate, payload.identifier);
    });
    if (!user) {
      throw new ApiError(401, "Invalid email or password. Check your credentials and try again.");
    }
    const status = user.role === "admin" ? "approved" : (user.verificationStatus ?? "approved");
    if (status !== "approved") {
      throw new ApiError(
        403,
        "Your documents are still under review. You can sign in after an administrator approves your account.",
      );
    }
    return { user, token: `mock.${user.role}.${user.id}` };
  }
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAsRole(role: Role): Promise<{ user: User; token: string }> {
  if (USE_MOCKS) {
    await delay();
    const user =
      DEMO_USERS.find((u) => u.role === role && (role === "admin" || (u.verificationStatus ?? "approved") === "approved")) ??
      DEMO_USERS.find((u) => u.role === role)!;
    return { user, token: `mock.${role}.${user.id}` };
  }
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export async function registerWithDocuments(formData: FormData): Promise<{ status: "pending" }> {
  if (USE_MOCKS) {
    await delay();
    const role = String(formData.get("role") || "customer") as Exclude<Role, "admin">;
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const idNumber = String(formData.get("idNumber") || formData.get("campusId") || "");
    const extra = String(formData.get("extra") || "");
    const customerSubRole = (formData.get("customerSubRole") as CustomerSubRole | null) || undefined;
    const documents = [
      fileDocument(formData, "verificationDoc", "verificationDocKind"),
      fileDocument(formData, "verificationDoc2", "verificationDocKind2"),
    ].filter((doc): doc is VerificationDocument => Boolean(doc));

    const application: VerificationApplication = {
      id: uid("app"),
      userId: uid("u"),
      name,
      email,
      role,
      customerSubRole,
      idNumber,
      extra: extra || undefined,
      documents,
      verificationStatus: "pending",
      submittedAt: new Date().toISOString(),
    };
    PENDING_APPLICATIONS.unshift(application);
    DEMO_USERS.push({
      id: application.userId,
      name,
      email,
      role,
      campusId: idNumber || application.userId,
      customerSubRole,
      idNumber,
      verificationStatus: "pending",
      verificationDocName: documents[0]?.name,
      verificationDocUrl: documents[0]?.url,
    });
    return { status: "pending" };
  }
  return apiFetch("/auth/register", {
    method: "POST",
    body: formData,
  });
}

export async function logoutRemote() {
  if (USE_MOCKS) {
    await delay(80);
    return;
  }
  await apiFetch("/auth/logout", { method: "POST" });
}
