"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fetchVerificationDocument, isProtectedDocument, listPendingApprovals, reviewApplication } from "@/lib/api/admin";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { VerificationDocument, VerificationStatus } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { useEffect, useState } from "react";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

function toneFor(status: VerificationStatus): "warn" | "brand" | "danger" {
  if (status === "approved") return "brand";
  if (status === "rejected") return "danger";
  return "warn";
}

/** Thumbnail for an admin-only document stored by the Flask API (fetched with the admin's token). */
function ProtectedThumbnail({ doc }: { doc: VerificationDocument }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!doc.contentType?.startsWith("image/")) return;
    let objectUrl = "";
    let cancelled = false;
    fetchVerificationDocument(doc.url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.url, doc.contentType]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="mt-2 h-20 w-20 rounded-lg object-cover" /> : null;
}

async function openProtectedDocument(doc: VerificationDocument) {
  // Open the tab straight away (inside the click) so pop-up blockers allow it.
  const tab = window.open("", "_blank");
  try {
    const blob = await fetchVerificationDocument(doc.url);
    const objectUrl = URL.createObjectURL(blob);
    if (tab) tab.location.href = objectUrl;
    else window.location.assign(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export function PendingApprovals() {
  const { data: all, reload } = useApi(listPendingApprovals);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const { busy: busyId, error, message, run, setError } = useAction();

  function review(id: string, status: Exclude<VerificationStatus, "pending">) {
    void run(id, () => reviewApplication(id, status), (a) => `${a.name} ${status}. ${status === "approved" ? "They can sign in now." : ""}`).then(
      // The mock database refreshes views by itself; the real API needs an explicit reload.
      () => void reload(),
    );
  }

  if (!all) {
    return (
      <Card id="pending-approvals" className="mt-4">
        <h2 className="font-bold">Pending Approvals</h2>
        <p className="mt-2 text-sm text-muted">Loading applications…</p>
      </Card>
    );
  }

  const applications = filter === "all" ? all : all.filter((a) => a.verificationStatus === filter);

  return (
    <Card id="pending-approvals" className="mt-4 scroll-mt-24">
      <h2 className="font-bold">Pending Approvals</h2>
      <p className="mt-1 text-sm text-muted">Review role documents submitted for campus account activation.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "soft" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f} · {f === "all" ? all.length : all.filter((a) => a.verificationStatus === f).length}
          </Button>
        ))}
      </div>
      {error && <p className="note-danger mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>}
      <div className="mt-4 space-y-4">
        {applications.length === 0 && <p className="text-sm text-muted">No {filter === "all" ? "" : filter} applications.</p>}
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
                <p className="text-xs text-muted">Submitted {formatWhen(app.submittedAt)}</p>
              </div>
              <Badge tone={toneFor(app.verificationStatus)}>{app.verificationStatus}</Badge>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {app.documents.map((doc) => (
                <li key={`${app.id}-${doc.name}`} className="rounded-xl bg-surface-2/50 px-3 py-2">
                  <p className="font-medium">{doc.kind}</p>
                  <p className="text-xs text-muted">
                    {doc.name}
                    {isProtectedDocument(doc.url) ? (
                      <button
                        type="button"
                        className="ml-2 text-brand"
                        onClick={() =>
                          void openProtectedDocument(doc).catch((err) =>
                            setError(err instanceof Error ? err.message : "Could not open the document."),
                          )
                        }
                      >
                        Open ↗
                      </button>
                    ) : doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="ml-2 text-brand">
                        Open ↗
                      </a>
                    ) : (
                      <span className="ml-2">· file preview not stored in demo</span>
                    )}
                  </p>
                  {isProtectedDocument(doc.url) ? (
                    <ProtectedThumbnail doc={doc} />
                  ) : doc.url ? (
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
