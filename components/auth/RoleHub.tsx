import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type RoleHubItem = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  badge?: string;
};

export function RoleHub({
  title,
  subtitle,
  items,
  footer,
}: {
  title: string;
  subtitle: string;
  items: RoleHubItem[];
  footer?: ReactNode;
}) {
  return (
    <Card className="p-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.href} className="rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{item.title}</h2>
                {item.badge ? <Badge tone="warn">{item.badge}</Badge> : null}
              </div>
              <Icon className="mt-2 h-4 w-4 text-brand" />
              <p className="mt-2 text-sm text-muted">{item.description}</p>
              <Link href={item.href} className="mt-4 inline-block">
                <Button>{item.cta}</Button>
              </Link>
            </div>
          );
        })}
      </div>
      {footer}
    </Card>
  );
}
