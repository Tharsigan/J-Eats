import { FoodDetailLoader } from "@/components/food/FoodDetailLoader";
import { MarketingShell } from "@/components/layout/MarketingShell";

export default async function PublicFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <FoodDetailLoader id={id} backHref="/explore" />
      </div>
    </MarketingShell>
  );
}
