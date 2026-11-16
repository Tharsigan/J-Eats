import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, PUBLIC_PATHS, ROLE_HOME, VERIFIED_COOKIE, canAccess, isVerified, roleFromPath } from "@/lib/rbac";
import type { Role, VerificationStatus } from "@/lib/types";

const ROLES: Role[] = ["customer", "courier", "cafeteria", "admin"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const roleCookie = req.cookies.get(AUTH_COOKIE)?.value as Role | undefined;
  const role = ROLES.includes(roleCookie as Role) ? (roleCookie as Role) : null;
  const verified = (req.cookies.get(VERIFIED_COOKIE)?.value || "approved") as VerificationStatus | "";

  if (PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))) {
    if (role && isVerified(verified, role) && pathname.startsWith("/login")) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const needed = roleFromPath(pathname);
  if (needed && !role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (role && needed && needed === role && !isVerified(verified, role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (role && !canAccess(role, pathname, verified)) {
    const url = req.nextUrl.clone();
    url.pathname = ROLE_HOME[role];
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
