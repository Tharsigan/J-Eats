"use client";

import { RoleLoginForm } from "@/components/auth/RoleLoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { DEMO_PASSWORD, login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CafeteriaLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState("canteen@sjp.ac.lk");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { user, token } = await login({ role: "cafeteria", identifier, password });
      setSession(user, token);
      router.push(ROLE_HOME.cafeteria);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <RoleLoginForm
        title="Cafeteria login"
        subtitle="Sign in to manage your stall, menu and pickup queue."
        identifierLabel="Email or stall ID"
        identifierPlaceholder="canteen@sjp.ac.lk"
        identifier={identifier}
        onIdentifierChange={setIdentifier}
        password={password}
        onPasswordChange={(value) => {
          setPassword(value);
          setError("");
        }}
        error={error}
        busy={busy}
        onSubmit={submit}
        footer={
          <p className="mt-5 text-sm text-muted">
            New stall?{" "}
            <Link href="/register/cafeteria" className="font-semibold text-text">
              Register cafeteria →
            </Link>
            <span className="mt-2 block text-xs">
              Demo · `canteen@sjp.ac.lk` (Central Canteen), `cafe@sjp.ac.lk` (Faculty Café), `burgerlab@`, `slice@`, `greenbowl@sjp.ac.lk` · pending `lawn.stall@sjp.ac.lk` · any password with 6+ characters.
            </span>
          </p>
        }
      />
    </AuthShell>
  );
}
