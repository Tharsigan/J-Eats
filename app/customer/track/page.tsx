import { TrackOrderView } from "@/components/orders/TrackOrderView";
import { Card } from "@/components/ui/Card";
import { Suspense } from "react";

export default function TrackPage() {
  return (
    <Suspense fallback={<Card className="text-sm text-muted">Loading tracking…</Card>}>
      <TrackOrderView />
    </Suspense>
  );
}
