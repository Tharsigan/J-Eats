import type { Role } from "./types";

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

export function canAccess(role: Role, pathname: string) {
  const needed = roleFromPath(pathname);
  if (!needed) return true;
  return needed === role;
}

export const AUTH_COOKIE = "jeats-role";
export const TOKEN_COOKIE = "jeats-token";
