import { ExploreFood } from "@/components/food/ExploreFood";

export default async function CustomerExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { q, cat } = await searchParams;
  return <ExploreFood itemHrefBase="/customer/food" initialQuery={q ?? ""} initialCategory={cat ?? "All food"} />;
}
