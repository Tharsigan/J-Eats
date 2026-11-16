"use client";

import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requestPasswordReset } from "@/lib/api/auth";
import { useAction } from "@/lib/hooks/useApi";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("mira.demo@example.edu");
  const { busy, error, message, run } = useAction();
  return (
    <AuthShell>
      <Card className="p-8">
        <h1 className="text-3xl font-bold tracking-tight">Reset your campus password.</h1>
        <p className="mt-2 text-sm text-muted">We&apos;ll send a reset link to your university email. Demo only — no mail is sent.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("send", () => requestPasswordReset(email), `Reset link queued for ${email}. In this demo, sign in with any 6+ character password for seeded accounts.`);
          }}
        >
          <label className="mt-6 block text-sm font-semibold">
            Email
            <input className="field mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button className="mt-4" type="submit" disabled={busy === "send"}>
            {busy === "send" ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        {message && <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">{message}</p>}
        {error && <p className="note-danger mt-4 rounded-xl px-3 py-2 text-sm">{error}</p>}
        <Link href="/login" className="mt-6 block text-sm font-semibold">
          Back to login →
        </Link>
      </Card>
    </AuthShell>
  );
}
