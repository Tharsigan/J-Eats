"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLogs, type SystemLog } from "@/lib/api/admin";
import { useEffect, useState } from "react";

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  useEffect(() => {
    getLogs().then(setLogs);
  }, []);

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Admin / System Settings & Role Access"
        title="Who can do what, and what just happened."
        subtitle="Performance logs plus sample role-access notes."
      />
      <Card>
        <h2 className="font-bold">Role access</h2>
        <p className="mt-2 text-sm text-muted">Administrators approve riders and cafeterias. Customers share the same ordering permissions regardless of identity label.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="soft">Customer · order</Badge>
          <Badge tone="soft">Rider · delivery</Badge>
          <Badge tone="soft">Cafeteria · kitchen</Badge>
          <Badge tone="warn">Admin · restricted</Badge>
        </div>
        <Button className="mt-4" variant="soft" size="sm">
          Save sample settings
        </Button>
      </Card>
      {logs.map((l) => (
        <Card key={l.id} className="flex items-start justify-between gap-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{l.level}</p>
            <p>{l.msg}</p>
          </div>
          <span className="text-xs text-muted">{l.at}</span>
        </Card>
      ))}
    </div>
  );
}
