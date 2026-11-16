import { ProfileView } from "@/components/customer/ProfileView";
import { Card } from "@/components/ui/Card";
import { Suspense } from "react";

export default function ProfilePage() {
  return (
    <Suspense fallback={<Card className="text-sm text-muted">Loading profile…</Card>}>
      <ProfileView />
    </Suspense>
  );
}
