import { FoodDetailLoader } from "@/components/food/FoodDetailLoader";

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FoodDetailLoader id={id} backHref="/customer/explore" />;
}
