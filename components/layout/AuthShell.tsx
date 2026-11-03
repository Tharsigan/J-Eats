import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import Image from "next/image";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Logo compact />
          <span className="hidden text-sm text-muted sm:block">Good food. Right on campus.</span>
        </Link>
        <ThemeToggle />
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 lg:grid-cols-2 lg:items-start">
        <div className="hidden lg:block">
          <div className="relative overflow-hidden rounded-[1.75rem]">
            <Image
              src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80"
              alt="Campus lunch"
              width={900}
              height={720}
              className="h-[420px] w-full object-cover"
              priority
            />
          </div>
          <h2 className="mt-8 text-4xl font-bold tracking-tight">Your campus, served fresh.</h2>
          <p className="mt-3 max-w-md text-muted">
            A proper lunch. A quick pickup. A little help from your campus community.
          </p>
          <div className="mt-5 flex gap-2">
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand">Campus pickup</span>
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand">
              Peer-to-peer delivery
            </span>
          </div>
          <p className="mt-6 text-xs text-muted">
            Authentication and matching require backend integration. This is a static design preview.
          </p>
        </div>
        <div>{children}</div>
      </div>
      <p className="px-4 pb-6 text-xs text-muted">© 2026 J Eats · Privacy · Terms · Static authentication states</p>
    </div>
  );
}
