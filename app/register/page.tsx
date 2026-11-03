"use client";

import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { loginAsRole } from "@/lib/api/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import type { Role } from "@/lib/types";
import { Bike, Shield, Store, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [kind, setKind] = useState("Student");

  async function go(role: Role) {
    const { user, token } = await loginAsRole(role);
    setSession(user, token);
    router.push(ROLE_HOME[role]);
  }

  return (
    <AuthShell>
      <Card className="p-8">
        <h1 className="text-3xl font-bold tracking-tight">Find your place on campus.</h1>
        <p className="mt-2 text-sm text-muted">Choose how you&apos;ll use J Eats. Your role determines your workspace.</p>

        <div className="mt-6 rounded-2xl border border-border p-5">
          <h2 className="font-semibold">Customer</h2>
          <UtensilsCrossed className="mt-2 h-4 w-4 text-brand" />
          <p className="mt-2 text-sm text-muted">Discover meals, order ahead and choose pickup or campus delivery.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Student", "Academic Staff", "Non-Academic Staff"].map((k) => (
              <Button key={k} type="button" size="sm" variant={kind === k ? "soft" : "outline"} onClick={() => setKind(k)}>
                {k}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">All customer categories have the same ordering permissions.</p>
          <Button className="mt-4" onClick={() => go("customer")}>
            Continue as customer
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border p-5">
            <h2 className="font-semibold">Delivery Rider</h2>
            <Bike className="mt-2 h-4 w-4 text-brand" />
            <p className="mt-2 text-sm text-muted">Earn by helping meals reach your campus community.</p>
            <p className="mt-3 text-xs font-semibold text-muted">Approval required</p>
            <Button className="mt-3" variant="soft" onClick={() => go("courier")}>
              Become a rider
            </Button>
          </div>
          <div className="rounded-2xl border border-border p-5">
            <h2 className="font-semibold">Cafeteria</h2>
            <Store className="mt-2 h-4 w-4 text-brand" />
            <p className="mt-2 text-sm text-muted">Manage your menu, orders and campus pickup points.</p>
            <p className="mt-3 text-xs font-semibold text-muted">Approval required</p>
            <Button className="mt-3" variant="soft" onClick={() => go("cafeteria")}>
              Register cafeteria
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border p-5">
          <h2 className="font-semibold">Administrator · restricted</h2>
          <Shield className="mt-2 h-4 w-4 text-brand" />
          <p className="mt-2 text-sm font-semibold">Authorised accounts only</p>
          <p className="mt-1 text-sm text-muted">
            No public administrator registration. Access is issued by secure invitation and approval.
          </p>
          <Button className="mt-3" variant="soft" onClick={() => go("admin")}>
            Secure administrator login
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted">
          Already part of J Eats?{" "}
          <a href="/login" className="font-semibold text-text">
            Log in →
          </a>
        </p>
      </Card>
    </AuthShell>
  );
}
