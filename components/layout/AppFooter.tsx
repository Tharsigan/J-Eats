import { Logo } from "@/components/layout/Logo";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-16 bg-[#07131c] text-slate-200">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <Logo inverted />
          <p className="mt-3 max-w-xs text-sm text-slate-400">
            Big cravings. Small breaks. Your campus, served fresh.
          </p>
        </div>
        <div>
          <p className="font-semibold">Explore J Eats</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>
              <Link href="/explore">Explore Food</Link>
            </li>
            <li>
              <Link href="/login">My Orders</Link>
            </li>
            <li>
              <Link href="/customer/stalls">Become a vendor</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Let&apos;s talk</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>hello@jeats.lk</li>
            <li>+94 11 280 1234</li>
            <li>Gangodawila, Nugegoda, Sri Lanka</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
        © 2026 J Eats. Made for campus life. · Privacy policy · Terms & conditions
      </div>
    </footer>
  );
}
