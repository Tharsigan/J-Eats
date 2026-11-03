import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRs } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";
import { Clock, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function FoodCard({
  item,
  vendorName,
  href,
  onAdd,
}: {
  item: MenuItem;
  vendorName?: string;
  href?: string;
  onAdd?: () => void;
}) {
  const to = href ?? `/food/${item.id}`;
  const soldOut = item.stock === 0 || !item.available;
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-border bg-surface shadow-[var(--shadow)]">
      <Link href={to} className="block">
        <div className="relative h-44 w-full">
          <Image src={item.image} alt={item.name} fill className="object-cover" />
          {item.tags[0] && (
            <Badge className="absolute left-3 top-3" tone="muted">
              {item.tags[0]}
            </Badge>
          )}
        </div>
      </Link>
      <div className="space-y-2 p-4">
        <Link href={to}>
          <h3 className="text-base font-semibold hover:text-brand">{item.name}</h3>
        </Link>
        <p className="text-sm text-muted">{vendorName}</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {item.rating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {item.prepMinutes[0]}–{item.prepMinutes[1]} min
          </span>
        </div>
        <p className={`text-xs font-semibold ${soldOut ? "text-danger" : item.stock < 5 ? "text-amber-600" : "text-brand"}`}>
          {soldOut ? "Sold Out 0" : item.stock < 5 ? `Low Stock ${item.stock}` : `Available ${item.stock}`}
        </p>
        <div className="flex items-center justify-between pt-2">
          <p className="text-lg font-bold">{formatRs(item.price)}</p>
          {soldOut ? (
            <span className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-muted">Unavailable</span>
          ) : onAdd ? (
            <Button size="sm" variant="soft" type="button" onClick={onAdd}>
              Add to Cart
            </Button>
          ) : (
            <Link href={to} className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-brand">
              Add to Cart
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
