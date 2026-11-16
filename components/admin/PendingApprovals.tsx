"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listPendingApprovals, reviewApplication } from "@/lib/api/admin";
import type { VerificationApplication, VerificationStatus } from "@/lib/types";
import { useEffect, useState } from "react";

function toneFor(status: VerificationStatus): "warn" | "brand" | "danger" {
  if (status === "approved") return "brand";
  if (status === "rejected") return "danger";
  return "warn";
}

export function PendingApprovals() {
  const [applications, setApplications] = useState<VerificationApplication[] | null>(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listPendingApprovals().then((next) => {
      if (!cancelled) setApplications(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function review(id: string, status: Exclude<VerificationStatus, "pending">) {
    setBusyId(id);
    await reviewApplication(id, status);
    const next = await listPendingApprovals();
    setApplications(next);
    setBusyId("");
  }

  if (!applications) {
    return (
      <Card id="pending-approvals" className="mt-4">
        <h2 className="font-bold">Pending Approvals</h2>
        <p className="mt-2 text-sm text-muted">Loading applications…</p>
      </Card>
    );
  }

  return (
    <Card id="pending-approvals" className="mt-4">
      <h2 className="font-bold">Pending Approvals</h2>
      <p className="mt-1 text-sm text-muted">Review role documents submitted for campus account activation.</p>
      <div className="mt-4 space-y-4">
        {applications.map((app) => (
          <div key={app.id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{app.name}</p>
                <p className="text-sm text-muted">
                  {app.email} · {app.role === "courier" ? "rider" : app.role}
                  {app.customerSubRole ? ` · ${app.customerSubRole}` : ""}
                </p>
                {app.idNumber && <p className="text-xs text-muted">ID · {app.idNumber}</p>}
                {app.extra && <p className="text-xs text-muted">{app.extra}</p>}
              </div>
              <Badge tone={toneFor(app.verificationStatus)}>{app.verificationStatus}</Badge>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {app.documents.map((doc) => (
                <li key={`${app.id}-${doc.name}`} className="rounded-xl bg-surface-2/50 px-3 py-2">
                  <p className="font-medium">{doc.kind}</p>
                  <p className="text-xs text-muted">{doc.name}</p>
                  {doc.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={doc.url} alt="" className="mt-2 h-20 w-20 rounded-lg object-cover" />
                  ) : null}
                </li>
              ))}
            </ul>
            {app.verificationStatus === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busyId === app.id} onClick={() => review(app.id, "approved")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === app.id}
                  onClick={() => review(app.id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
