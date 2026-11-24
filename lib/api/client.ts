import { DB_EVENT } from "../mock-db/db";
import { TOKEN_COOKIE } from "../rbac";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * Features that use the real Flask API even while USE_MOCKS is on, e.g.
 * NEXT_PUBLIC_LIVE_FEATURES=auth,registration,approvals,users
 * Everything not listed keeps using the browser mock database.
 */
export type LiveFeature =
  | "auth"
  | "registration"
  | "approvals"
  | "users"
  | "menu"
  | "cafeteria"
  | "wallet"
  | "orders";
const LIVE_FEATURES = new Set(
  (process.env.NEXT_PUBLIC_LIVE_FEATURES ?? "")
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean),
);

/** True when `feature` should call Flask: all features with USE_MOCKS=false, or the ones listed in LIVE_FEATURES. */
export function isLive(feature: LiveFeature) {
  return !USE_MOCKS || LIVE_FEATURES.has(feature);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : "";
}

async function send(path: string, init: RequestInit = {}) {
  const token = readCookie(TOKEN_COOKIE);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the J Eats API. Is the Flask server running?");
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      // not JSON: keep the raw text
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

/** Flask-ready fetch wrapper. Swap USE_MOCKS off to hit the real REST API. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  const data = (await res.json()) as T;
  // Like the mock database's change event: a successful write refreshes every view that uses useApi().
  if ((init.method ?? "GET").toUpperCase() !== "GET" && typeof window !== "undefined") {
    window.dispatchEvent(new Event(DB_EVENT));
  }
  return data;
}

/** apiFetch for "get one" calls: a 404 becomes `undefined`, like the mock's `find()`. */
export async function apiFetchOptional<T>(path: string): Promise<T | undefined> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

/** Like apiFetch, but for files (e.g. verification documents) that need the sign-in token. */
export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await send(path, init);
  return res.blob();
}

export { USE_MOCKS, BASE as API_BASE };

function decodeJwtPayload(token: string): { sub?: string; role?: string; exp?: number } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Who is signed in, read from the token cookie. Mock tokens look like
 * `mock.<role>.<userId>`; real sign-ins carry a JWT from Flask. The JWT is only
 * decoded here (not verified) so mock-backed pages know the user id; Flask
 * verifies the signature on every API call.
 */
export function currentSession(): { role: string; userId: string } | null {
  const token = readCookie(TOKEN_COOKIE);
  if (token.startsWith("mock.")) {
    const [, role, ...rest] = token.split(".");
    const userId = rest.join(".");
    return role && userId ? { role, userId } : null;
  }
  const claims = token ? decodeJwtPayload(token) : null;
  if (!claims?.sub || !claims.role) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return { role: claims.role, userId: claims.sub };
}

export function requireSession() {
  const session = currentSession();
  if (!session) throw new ApiError(401, "Your session has expired. Please sign in again.");
  return session;
}
