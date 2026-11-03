import { TOKEN_COOKIE } from "../rbac";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : "";
}

/** Flask-ready fetch wrapper. Swap USE_MOCKS off to hit the real REST API. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readCookie(TOKEN_COOKIE);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export { USE_MOCKS, BASE as API_BASE };
