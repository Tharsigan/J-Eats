import { FoodDetailView } from "@/components/food/FoodDetailView";
import { MENU } from "@/lib/mock-data/campus";
import { notFound } from "next/navigation";

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = MENU.find((m) => m.id === id || m.slug === id);
  if (!item) notFound();
  return <FoodDetailView item={item} backHref="/customer/explore" />;
}
