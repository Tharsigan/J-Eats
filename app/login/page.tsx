import { DemoQuickLogin } from "@/components/auth/DemoQuickLogin";
import { RoleHub } from "@/components/auth/RoleHub";
import { AuthShell } from "@/components/layout/AuthShell";
import { Bike, Shield, Store, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export default function LoginHubPage() {
  return (
    <AuthShell>
      <RoleHub
        title="Welcome back, foodie."
        subtitle="Choose how you sign in to J Eats."
        items={[
          {
            href: "/login/customer",
            title: "Customer",
            description: "Students and staff ordering campus meals.",
            icon: UtensilsCrossed,
            cta: "Customer login",
          },
          {
            href: "/login/rider",
            title: "Rider",
            description: "Delivery couriers collecting and dropping off orders.",
            icon: Bike,
            cta: "Rider login",
          },
          {
            href: "/login/cafeteria",
            title: "Cafeteria",
            description: "Vendors managing menus, queues and pickup points.",
            icon: Store,
            cta: "Cafeteria login",
          },
          {
            href: "/login/admin",
            title: "Administrator",
            description: "Campus operations and verification reviews.",
            icon: Shield,
            cta: "Admin login",
          },
        ]}
        footer={
          <>
          <DemoQuickLogin />
          <p className="mt-5 text-sm text-muted">
            No account yet?{" "}
            <Link href="/register" className="font-semibold text-text">
              Create account →
            </Link>
          </p>
          </>
        }
      />
    </AuthShell>
  );
}
