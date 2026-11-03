"use client";

import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { loginAsRole } from "@/lib/api/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("mira.demo@example.edu");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    if (password.length < 6) {
      setError("Enter a valid password to continue.");
      setBusy(false);
      return;
    }
    const { user, token } = await loginAsRole("customer");
    setSession(user, token);
    router.push(ROLE_HOME.customer);
  }

  return (
    <AuthShell>
      <Card className="p-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, foodie.</h1>
        <p className="mt-2 text-sm text-muted">Log in to your J Eats campus account.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
        >
          <label className="block text-sm font-semibold">
            Email or username
            <input className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <span className="relative mt-1 block">
              <input
                className={`field ${error ? "border-danger" : ""}`}
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                onClick={() => setShow((v) => !v)}
              >
                {show ? "Hide" : "Show password"}
              </button>
            </span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="soft" size="sm">
              Remember me
            </Button>
            <a href="/forgot-password">
              <Button type="button" variant="soft" size="sm">
                Forgot password?
              </Button>
            </a>
          </div>
          {error && (
            <p className="note-danger rounded-xl px-3 py-2 text-sm">
              Invalid email or password. Check your credentials and try again.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          No account yet?{" "}
          <a href="/register" className="font-semibold text-text">
            Create account →
          </a>
        </p>
        <p className="mt-2 text-sm text-muted">
          Administrator?{" "}
          <button
            type="button"
            className="font-semibold text-text"
            onClick={async () => {
              const { user, token } = await loginAsRole("admin");
              setSession(user, token);
              router.push(ROLE_HOME.admin);
            }}
          >
            Use secure administrator login.
          </button>
        </p>
        <p className="mt-6 text-xs text-muted">Demo data · integrations not connected. Any password of 6+ characters signs you in as Mira.</p>
      </Card>
    </AuthShell>
  );
}
