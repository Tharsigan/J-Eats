import { ExploreFood } from "@/components/food/ExploreFood";
import { MarketingShell } from "@/components/layout/MarketingShell";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { q, cat } = await searchParams;
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ExploreFood initialQuery={q ?? ""} initialCategory={cat ?? "All food"} />
      </div>
    </MarketingShell>
  );
}
