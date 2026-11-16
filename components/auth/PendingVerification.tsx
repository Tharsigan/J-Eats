"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { loginAsRole } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PendingVerification({
  title = "Pending Admin Verification",
  loginHref,
}: {
  title?: string;
  loginHref: string;
}) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [busy, setBusy] = useState(false);

  async function reviewAsAdmin() {
    setBusy(true);
    const { user, token } = await loginAsRole("admin");
    setSession(user, token);
    router.push("/admin#pending-approvals");
  }

  return (
    <Card className="p-8">
      <Badge tone="warn">Pending review</Badge>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="note-warn mt-4 rounded-xl px-3 py-2 text-sm">
        Your documents are under review. An administrator will approve or reject this application before the account
        can sign in.
      </p>
      <p className="mt-3 text-sm text-muted">
        You will not be able to access a dashboard until verification is complete. Keep your campus ID handy for
        follow-up.
      </p>
      <div className="mt-5 rounded-2xl border border-dashed border-brand/40 bg-surface-2/50 p-4 text-sm">
        <p className="font-semibold">Demo: approve it yourself</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Open the admin workspace and click <span className="font-semibold text-text">Approve</span> on your application.</li>
          <li>Sign out, then log in with the email and password you just registered.</li>
        </ol>
        <Button className="mt-3" size="sm" disabled={busy} onClick={() => void reviewAsAdmin()}>
          {busy ? "Opening…" : "Review as admin →"}
        </Button>
      </div>
      <Link href={loginHref} className="mt-6 inline-block">
        <Button variant="soft">Back to login</Button>
      </Link>
    </Card>
  );
}
