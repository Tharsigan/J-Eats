"use client";

import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV, WORKSPACE_META } from "@/lib/nav";
import { useAuthStore } from "@/lib/stores/auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const items = NAV[role];
  const meta = WORKSPACE_META[role];
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === `/${role}`) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (
    <>
      <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {meta.workspace}
      </p>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium",
                active ? "bg-[var(--nav-active)] text-brand" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-2xl border border-border bg-bg p-4 text-xs text-muted">
        <p className="font-semibold text-text">Designed for campus life</p>
        <p className="mt-1">Demo workspace. No live services are connected.</p>
      </div>
      <div className="mt-6 space-y-2 text-sm">
        <a href="mailto:hello@jeats.lk" className="block text-muted hover:text-text">
          Help & support ↗
        </a>
        <button
          type="button"
          className="text-muted hover:text-text"
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link href={`/${role}`} className="flex items-center gap-3">
              <Logo compact />
              <span className="leading-tight">
                <span className="block text-sm font-bold">University of Jayewardenepura</span>
                <span className="block text-xs text-muted">{meta.subtitle}</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand sm:inline">
              {meta.account}
            </span>
          </div>
        </div>
      </header>
      <div className="lg:flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface px-3 py-6 lg:block">{nav}</aside>
        {open && (
          <div className="border-b border-border bg-surface px-4 py-4 lg:hidden">{nav}</div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
