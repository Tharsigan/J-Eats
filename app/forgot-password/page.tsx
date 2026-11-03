"use client";

import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <AuthShell>
      <Card className="p-8">
        <h1 className="text-3xl font-bold tracking-tight">Reset your campus password.</h1>
        <p className="mt-2 text-sm text-muted">We&apos;ll send a reset link to your university email. Demo only — no mail is sent.</p>
        <label className="mt-6 block text-sm font-semibold">
          Email
          <input className="field mt-1" defaultValue="mira.demo@example.edu" />
        </label>
        <Button className="mt-4" onClick={() => setSent(true)}>
          Send reset link
        </Button>
        {sent && <p className="note-ok mt-4 rounded-xl px-3 py-2 text-sm">Reset email queued in this demo. Check back on the login screen.</p>}
        <a href="/login" className="mt-6 block text-sm font-semibold">
          Back to login →
        </a>
      </Card>
    </AuthShell>
  );
}
