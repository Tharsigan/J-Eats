"use client";

import { ExploreFood } from "@/components/food/ExploreFood";
import { MarketingShell } from "@/components/layout/MarketingShell";

export default function ExplorePage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ExploreFood />
      </div>
    </MarketingShell>
  );
}
