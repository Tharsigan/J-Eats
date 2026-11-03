import { FoodDetailView } from "@/components/food/FoodDetailView";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { MENU } from "@/lib/mock-data/campus";
import { notFound } from "next/navigation";

export default async function PublicFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = MENU.find((m) => m.id === id || m.slug === id);
  if (!item) notFound();
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <FoodDetailView item={item} backHref="/explore" />
      </div>
    </MarketingShell>
  );
}
