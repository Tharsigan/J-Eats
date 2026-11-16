"use client";

import { RoleLoginForm } from "@/components/auth/RoleLoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { DEMO_PASSWORD, login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState("admin@jeats.lk");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { user, token } = await login({ role: "admin", identifier, password });
      setSession(user, token);
      router.push(ROLE_HOME.admin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <RoleLoginForm
        title="Administrator login"
        subtitle="Authorised campus operations access only."
        identifierLabel="Admin email"
        identifierPlaceholder="admin@jeats.lk"
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
        extraNote={
          <p className="text-xs text-muted">
            Administrator accounts are provisioned internally. There is no public registration. Demo · `admin@jeats.lk` · any password
            with 6+ characters.
          </p>
        }
      />
    </AuthShell>
  );
}
