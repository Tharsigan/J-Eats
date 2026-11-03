"use client";

import { AppFooter } from "./AppFooter";
import { CampusBanner } from "./CampusBanner";
import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { MARKETING_NAV } from "@/lib/nav";
import { useAuthStore } from "@/lib/stores/auth";
import { cartCount, useCartStore } from "@/lib/stores/cart";
import { ROLE_HOME } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Menu, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const lines = useCartStore((s) => s.lines);
  const count = useMemo(() => cartCount(lines), [lines]);
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="shrink-0">
            <Logo compact />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium lg:flex">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.label}
                href={user && item.href === "/login" ? ROLE_HOME[user.role] : item.href}
                className={cn(
                  "transition hover:text-brand",
                  pathname === item.href ? "text-brand" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link href={ROLE_HOME[user.role]}>
                <Button size="sm">Workspace</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm">Login</Button>
              </Link>
            )}
            <Link
              href={user ? "/customer/pre-orders" : "/login"}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="Cart"
            >
              <ShoppingBag className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 lg:hidden">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <CampusBanner />
      <main className="relative z-10">{children}</main>
      <AppFooter />
    </div>
  );
}
