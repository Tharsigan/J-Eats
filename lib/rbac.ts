import type { Role, VerificationStatus } from "./types";

export const ROLE_HOME: Record<Role, string> = {
  customer: "/customer",
  courier: "/courier",
  cafeteria: "/cafeteria",
  admin: "/admin",
};

export const ROLE_PREFIX: Record<Role, string> = {
  customer: "/customer",
  courier: "/courier",
  cafeteria: "/cafeteria",
  admin: "/admin",
};

export const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/explore", "/food"];

export function roleFromPath(pathname: string): Role | null {
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/courier")) return "courier";
  if (pathname.startsWith("/cafeteria")) return "cafeteria";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export function isVerified(status: VerificationStatus | undefined | "", role?: Role | null) {
  if (role === "admin") return true;
  return (status || "approved") === "approved";
}

export function canAccess(role: Role, pathname: string, verified?: VerificationStatus | "") {
  const needed = roleFromPath(pathname);
  if (!needed) return true;
  if (needed !== role) return false;
  return isVerified(verified, role);
}

export const AUTH_COOKIE = "jeats-role";
export const TOKEN_COOKIE = "jeats-token";
export const VERIFIED_COOKIE = "jeats-verified";
