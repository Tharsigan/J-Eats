import { readDb, writeDb } from "../mock-db/db";
import { logEvent, notify } from "../mock-db/events";
import type { CustomerSubRole, Role, User, VerificationApplication, VerificationDocument } from "../types";
import { delay, uid } from "../utils";
import { ApiError, apiFetch, currentSession, USE_MOCKS } from "./client";

export type LoginPayload = {
  role: Role;
  identifier: string;
  password: string;
  customerSubRole?: CustomerSubRole;
};

/** Seeded demo accounts accept any 6+ character password; this one is pre-filled on the login forms. */
export const DEMO_PASSWORD = "demo123";

/** Inline previews above this size are not persisted (localStorage is ~5MB). */
const MAX_INLINE_PREVIEW = 400 * 1024;

function matchesIdentifier(user: User, identifier: string) {
  const ident = identifier.trim().toLowerCase();
  return [user.email, user.idNumber, user.campusId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === ident);
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function fileDocument(formData: FormData, fileKey: string, kindKey: string): Promise<VerificationDocument | null> {
  const file = formData.get(fileKey);
  if (!(file instanceof File) || file.size === 0) return null;
  const kind = String(formData.get(kindKey) || file.name);
  const url =
    file.type.startsWith("image/") && file.size <= MAX_INLINE_PREVIEW && typeof FileReader !== "undefined"
      ? await readAsDataUrl(file)
      : "";
  return { name: file.name, url, kind };
}

function strip(user: User & { password?: string }): User {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}

export async function login(payload: LoginPayload): Promise<{ user: User; token: string }> {
  if (USE_MOCKS) {
    await delay();
    if (!payload.identifier.trim()) throw new ApiError(400, "Enter your email or campus ID.");
    if (payload.password.length < 6) {
      throw new ApiError(
        401,
        payload.password
          ? "Passwords have at least 6 characters. Demo accounts accept any 6+ character password, e.g. demo123."
          : "Enter your password. Demo accounts accept any 6+ character password, e.g. demo123.",
      );
    }
    const db = readDb();
    const user = db.users.find((candidate) => {
      if (candidate.role !== payload.role) return false;
      if (payload.role === "customer" && payload.customerSubRole && candidate.customerSubRole !== payload.customerSubRole) {
        return false;
      }
      return matchesIdentifier(candidate, payload.identifier);
    });
    // Seeded demo accounts accept any 6+ character password; accounts registered in the demo keep theirs.
    if (!user || (user.password && user.password !== payload.password)) {
      if (!user) {
        const elsewhere = db.users.find((u) => matchesIdentifier(u, payload.identifier));
        if (elsewhere && elsewhere.role !== payload.role) {
          const label = { customer: "a customer", courier: "a rider", cafeteria: "a cafeteria", admin: "an administrator" }[
            elsewhere.role
          ];
          throw new ApiError(401, `This account is registered as ${label}. Use that login instead.`);
        }
        if (elsewhere?.customerSubRole) {
          const label = { student: "Student", academic: "Academic Staff", "non-academic": "Non-Academic Staff" }[
            elsewhere.customerSubRole
          ];
          throw new ApiError(401, `This account is registered as ${label}. Switch to the ${label} tab above.`);
        }
      }
      throw new ApiError(
        401,
        user
          ? "Incorrect password for this account. Use the password you chose when you registered."
          : "No account matches that email or ID for this role. Check the demo accounts listed below, or register first.",
      );
    }
    if (user.status === "suspended") {
      throw new ApiError(403, "This account has been suspended by an administrator. Contact J Eats support.");
    }
    const status = user.role === "admin" ? "approved" : (user.verificationStatus ?? "approved");
    if (status === "rejected") {
      throw new ApiError(403, "Your verification documents were rejected. Please register again with clearer documents.");
    }
    if (status !== "approved") {
      throw new ApiError(
        403,
        "Your documents are still under review. You can sign in after an administrator approves your account (demo: use the Admin quick sign-in on the login page and approve it under Pending Approvals).",
      );
    }
    writeDb((d) => logEvent(d, "info", `${user.name} signed in (${user.role})`));
    return { user: strip(user), token: `mock.${user.role}.${user.id}` };
  }
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAsRole(role: Role): Promise<{ user: User; token: string }> {
  if (USE_MOCKS) {
    await delay();
    const users = readDb().users;
    const user =
      users.find((u) => u.role === role && (role === "admin" || (u.verificationStatus ?? "approved") === "approved")) ??
      users.find((u) => u.role === role)!;
    return { user: strip(user), token: `mock.${role}.${user.id}` };
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
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const idNumber = String(formData.get("idNumber") || formData.get("campusId") || "").trim();
    const extra = String(formData.get("extra") || "");
    const customerSubRole = (formData.get("customerSubRole") as CustomerSubRole | null) || undefined;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Enter a valid email address.");
    const documents = (
      await Promise.all([
        fileDocument(formData, "verificationDoc", "verificationDocKind"),
        fileDocument(formData, "verificationDoc2", "verificationDocKind2"),
      ])
    ).filter((doc): doc is VerificationDocument => Boolean(doc));

    writeDb((db) => {
      const taken = db.users.find(
        (u) =>
          u.email.toLowerCase() === email.toLowerCase() ||
          (idNumber && (u.idNumber ?? "").toLowerCase() === idNumber.toLowerCase()),
      );
      if (taken && taken.verificationStatus !== "rejected") {
        throw new ApiError(409, "An account with this email or ID already exists. Try logging in instead.");
      }
      if (taken) {
        // Rejected applicants may re-apply with the same details.
        db.users = db.users.filter((u) => u.id !== taken.id);
      }
      const userId = uid("u");
      const application: VerificationApplication = {
        id: uid("app"),
        userId,
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
      db.applications.unshift(application);
      db.users.push({
        id: userId,
        name,
        email,
        password,
        role,
        campusId: idNumber || userId,
        customerSubRole,
        idNumber,
        verificationStatus: "pending",
        verificationDocName: documents[0]?.name,
        verificationDocUrl: documents[0]?.url,
        status: "active",
        createdAt: application.submittedAt,
      });
      const label = role === "courier" ? "rider" : role;
      notify(db, { role: "admin" }, `New ${label} application`, `${name} · ${email} submitted ${documents.length} document(s).`, "/admin#pending-approvals");
      logEvent(db, "info", `${label[0].toUpperCase()}${label.slice(1)} application submitted: ${name}`);
    });
    return { status: "pending" };
  }
  return apiFetch("/auth/register", {
    method: "POST",
    body: formData,
  });
}

/** Demo password reset: confirms the account exists. No email is sent. */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  if (USE_MOCKS) {
    await delay();
    const user = readDb().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new ApiError(404, "No J Eats account uses that email address.");
    writeDb((db) => logEvent(db, "info", `Password reset requested for ${user.email}`));
    return { ok: true };
  }
  return apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export async function updateProfile(patch: Partial<Pick<User, "name" | "phone">>): Promise<User> {
  if (USE_MOCKS) {
    await delay(150);
    const session = currentSession();
    if (!session) throw new ApiError(401, "Please sign in again.");
    return writeDb((db) => {
      const user = db.users.find((u) => u.id === session.userId);
      if (!user) throw new ApiError(404, "Account not found.");
      if (patch.name !== undefined) {
        if (!patch.name.trim()) throw new ApiError(400, "Name cannot be empty.");
        user.name = patch.name.trim();
      }
      if (patch.phone !== undefined) user.phone = patch.phone.trim();
      return strip(user);
    });
  }
  return apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
}

export async function logoutRemote() {
  if (USE_MOCKS) {
    await delay(80);
    return;
  }
  await apiFetch("/auth/logout", { method: "POST" });
}
