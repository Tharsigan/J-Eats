"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { useAuthStore } from "@/lib/stores/auth";
import { cartCount, useCartStore } from "@/lib/stores/cart";
import { NAV } from "@/lib/nav";
import type { Role } from "@/lib/types";
import { Menu, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

export function AppHeader({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const lines = useCartStore((s) => s.lines);
  const [open, setOpen] = useState(false);
  const items = NAV[role];
  const count = useMemo(() => cartCount(lines), [lines]);

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={`/${role}`} className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium lg:flex">
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
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
          {role === "customer" && (
            <Link
              href="/customer/pre-orders"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border"
              aria-label="Cart"
            >
              <ShoppingBag className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          )}
          {user && <NotificationBell className="h-10 w-10" />}
          {user ? (
            <Button
              size="sm"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              Logout
            </Button>
          ) : (
            <Link href="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 lg:hidden">
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 text-sm hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
