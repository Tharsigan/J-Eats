"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listUsers, setUserStatus } from "@/lib/api/admin";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { Role } from "@/lib/types";
import { useMemo, useState } from "react";

const ROLE_LABEL: Record<Role, string> = { customer: "Customer", courier: "Rider", cafeteria: "Cafeteria", admin: "Admin" };

export default function AdminUsersPage() {
  const { data: users, loading } = useApi(listUsers);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [status, setStatus] = useState<"all" | "approved" | "pending" | "rejected" | "suspended">("all");
  const { busy, error, message, run } = useAction();

  const rows = useMemo(
    () =>
      (users ?? []).filter((u) => {
        const hay = `${u.name} ${u.email} ${u.idNumber ?? ""} ${u.campusId}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
        if (role !== "all" && u.role !== role) return false;
        if (status === "suspended") return u.status === "suspended";
        if (status !== "all" && (u.verificationStatus ?? "approved") !== status) return false;
        return true;
      }),
    [users, q, role, status],
  );

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Admin / Users"
        title="Every account on the platform."
        subtitle="Search, filter and suspend or reactivate customer, rider and cafeteria accounts."
      />
      <Card className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Search
          <input className="field mt-1 w-64" placeholder="Name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Role
          <select className="field mt-1" value={role} onChange={(e) => setRole(e.target.value as Role | "all")}>
            <option value="all">All roles</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Status
          <select className="field mt-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {["all", "approved", "pending", "rejected", "suspended"].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-sm text-muted">
          {rows.length} of {users?.length ?? 0} accounts
        </p>
      </Card>
      {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="font-medium">Role</th>
              <th className="font-medium">ID</th>
              <th className="font-medium">Verification</th>
              <th className="font-medium">Account</th>
              <th className="pr-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && !users && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-muted">
                  Loading accounts…
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const v = u.verificationStatus ?? "approved";
              const suspended = u.status === "suspended";
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td>
                    {ROLE_LABEL[u.role]}
                    {u.customerSubRole ? <span className="block text-xs capitalize text-muted">{u.customerSubRole.replace("-", " ")}</span> : null}
                  </td>
                  <td className="text-muted">{u.idNumber ?? u.campusId}</td>
                  <td>
                    <Badge tone={v === "approved" ? "brand" : v === "rejected" ? "danger" : "warn"}>{v}</Badge>
                  </td>
                  <td>
                    <Badge tone={suspended ? "danger" : "soft"}>{suspended ? "Suspended" : "Active"}</Badge>
                  </td>
                  <td className="pr-4 text-right">
                    {u.role === "admin" ? (
                      <span className="text-xs text-muted">Protected</span>
                    ) : v === "pending" ? (
                      <a href="/admin#pending-approvals" className="text-sm font-semibold text-brand">
                        Review →
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant={suspended ? "primary" : "outline"}
                        disabled={busy === u.id}
                        onClick={() =>
                          void run(u.id, () => setUserStatus(u.id, suspended ? "active" : "suspended"), `${u.name} ${suspended ? "reactivated" : "suspended"}.`)
                        }
                      >
                        {suspended ? "Reactivate" : "Suspend"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
