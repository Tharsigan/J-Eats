import { Badge } from "@/components/ui/Badge";
import type { OrderStatus } from "@/lib/types";
import { statusLabel } from "@/lib/utils";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const tone =
    status === "cancelled" ? "danger" : status === "delivered" ? "brand" : status === "placed" ? "warn" : "soft";
  return (
    <Badge tone={tone} className={className}>
      {status === "delivered" ? "Completed" : statusLabel(status)}
    </Badge>
  );
}
