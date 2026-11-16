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

export default function RiderLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState("ari@sjp.ac.lk");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { user, token } = await login({ role: "courier", identifier, password });
      setSession(user, token);
      router.push(ROLE_HOME.courier);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <RoleLoginForm
        title="Rider login"
        subtitle="Sign in to pick up campus deliveries."
        identifierLabel="Email or rider ID"
        identifierPlaceholder="ari@sjp.ac.lk"
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
            Want to deliver?{" "}
            <Link href="/register/rider" className="font-semibold text-text">
              Register as rider →
            </Link>
            <span className="mt-2 block text-xs">
              Demo · approved `ari@sjp.ac.lk` or `dilan.rider@sjp.ac.lk` · pending `kasun.rider@sjp.ac.lk` · any password with 6+ characters.
            </span>
          </p>
        }
      />
    </AuthShell>
  );
}
