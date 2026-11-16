"use client";

import { Button } from "@/components/ui/Button";
import { loginAsRole } from "@/lib/api/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import type { Role } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES: { role: Role; label: string; who: string }[] = [
  { role: "customer", label: "Customer", who: "Mira Sen · student" },
  { role: "cafeteria", label: "Cafeteria", who: "Central Canteen" },
  { role: "courier", label: "Rider", who: "Ari Perera" },
  { role: "admin", label: "Admin", who: "J Eats Admin" },
];

/** One-click sign-in with the seeded demo accounts (mock mode only). */
export function DemoQuickLogin({ redirect }: { redirect?: Partial<Record<Role, string>> }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState("");

  async function go(role: Role) {
    setBusy(role);
    setError("");
    try {
      const { user, token } = await loginAsRole(role);
      setSession(user, token);
      router.push(redirect?.[role] ?? ROLE_HOME[role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand/40 bg-surface-2/50 p-4">
      <p className="text-sm font-semibold">Quick demo sign-in</p>
      <p className="mt-1 text-xs text-muted">One click, no password needed. Or open a role above and use any 6+ character password.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => (
          <Button key={r.role} variant="outline" className="h-auto justify-start py-2 text-left" disabled={busy !== null} onClick={() => void go(r.role)}>
            <span>
              <span className="block">{busy === r.role ? "Signing in…" : `${r.label} demo`}</span>
              <span className="block text-xs font-normal text-muted">{r.who}</span>
            </span>
          </Button>
        ))}
      </div>
      {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
    </div>
  );
}
