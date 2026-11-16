import { RoleHub } from "@/components/auth/RoleHub";
import { AuthShell } from "@/components/layout/AuthShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Bike, Shield, Store, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export default function RegisterHubPage() {
  return (
    <AuthShell>
      <RoleHub
        title="Find your place on campus."
        subtitle="Choose how you'll use J Eats. Document verification is required before activation."
        items={[
          {
            href: "/register/customer",
            title: "Customer",
            description: "Students and staff: order ahead and choose pickup or campus delivery.",
            icon: UtensilsCrossed,
            cta: "Register as customer",
            badge: "ID required",
          },
          {
            href: "/register/rider",
            title: "Delivery Rider",
            description: "Earn by helping meals reach your campus community.",
            icon: Bike,
            cta: "Become a rider",
            badge: "Approval required",
          },
          {
            href: "/register/cafeteria",
            title: "Cafeteria",
            description: "Manage your menu, orders and campus pickup points.",
            icon: Store,
            cta: "Register cafeteria",
            badge: "Approval required",
          },
        ]}
        footer={
          <>
            <div className="mt-4 rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">Administrator · restricted</h2>
                <Badge tone="muted">Invitation only</Badge>
              </div>
              <Shield className="mt-2 h-4 w-4 text-brand" />
              <p className="mt-2 text-sm font-semibold">Authorised accounts only</p>
              <p className="mt-1 text-sm text-muted">
                No public administrator registration. Access is issued by secure invitation and approval.
              </p>
              <Link href="/login/admin" className="mt-3 inline-block">
                <Button variant="soft">Secure administrator login</Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">
              Already part of J Eats?{" "}
              <Link href="/login" className="font-semibold text-text">
                Log in →
              </Link>
            </p>
          </>
        }
      />
    </AuthShell>
  );
}
