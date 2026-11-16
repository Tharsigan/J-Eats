"use client";

import { FoodDetailView } from "./FoodDetailView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMenuItem } from "@/lib/api/menu";
import { useApi } from "@/lib/hooks/useApi";
import Link from "next/link";

/** Loads a menu item on the client so items created by cafeterias in the demo resolve too. */
export function FoodDetailLoader({ id, backHref }: { id: string; backHref: string }) {
  const { data: item, loading } = useApi(() => getMenuItem(id), [id]);

  if (loading && !item) {
    return <Card className="text-sm text-muted">Loading meal…</Card>;
  }
  if (!item) {
    return (
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold">Meal not found</h1>
        <p className="text-sm text-muted">This item may have been removed from the menu.</p>
        <Link href={backHref}>
          <Button variant="soft">← Back to Explore Food</Button>
        </Link>
      </Card>
    );
  }
  return <FoodDetailView item={item} backHref={backHref} />;
}
